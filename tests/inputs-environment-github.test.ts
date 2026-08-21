import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import test from "node:test";

import { sanitizedChildEnvironment } from "../src/environment.ts";
import { AdapterError } from "../src/errors.ts";
import {
  emptyOutputs,
  WorkflowCommandGuard,
  writeOutputs,
} from "../src/github.ts";
import { parseAttachments, readActionInputs } from "../src/inputs.ts";

async function withWorkspace(
  callback: (workspace: string) => Promise<void>,
): Promise<void> {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "scherzo-inputs-"));
  try {
    await callback(workspace);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

test("inputs preserve bytes, defaults, path authority, and exact parallel digits", async () => {
  await withWorkspace(async (workspace) => {
    const environment: NodeJS.ProcessEnv = {
      GITHUB_WORKSPACE: workspace,
      INPUT_WORKFLOW: "flows/run.yaml",
      INPUT_PROMPT: "  exact prompt\r\n",
      INPUT_ATTACHMENTS: "image/png=media/a.png\r\nimage/png=media/a.png\r\n",
      "INPUT_MAX-PARALLEL": "0256",
      INPUT_EXPORT: "Result",
    };
    const inputs = await readActionInputs(environment);
    assert.equal(inputs.workspace, workspace);
    assert.equal(inputs.workflow, path.join(workspace, "flows/run.yaml"));
    assert.equal(inputs.sourceRoot, workspace);
    assert.equal(inputs.executionRoot, workspace);
    assert.equal(inputs.prompt, "  exact prompt\r\n");
    assert.equal(inputs.maximumParallel, "0256");
    assert.equal(inputs.selectedExport, "Result");
    assert.deepEqual(inputs.attachments, [
      { mediaType: "image/png", path: path.join(workspace, "media/a.png") },
      { mediaType: "image/png", path: path.join(workspace, "media/a.png") },
    ]);
  });
});

test("prompt conflict is rejected without opening the prompt file", async () => {
  await withWorkspace(async (workspace) => {
    const promptFile = path.join(workspace, "must-not-be-read");
    await writeFile(promptFile, "private bytes", { mode: 0o000 });
    await assert.rejects(
      readActionInputs({
        GITHUB_WORKSPACE: workspace,
        INPUT_WORKFLOW: "workflow.yaml",
        INPUT_PROMPT: "inline",
        "INPUT_PROMPT-FILE": "must-not-be-read",
      }),
      (error: unknown) =>
        error instanceof AdapterError && error.code === "input_invalid",
    );
  });
});

test("prompt-file is passed as a path without Action reads", async () => {
  await withWorkspace(async (workspace) => {
    const promptFile = path.join(workspace, "-");
    const inputs = await readActionInputs({
      GITHUB_WORKSPACE: workspace,
      INPUT_WORKFLOW: "workflow.yaml",
      "INPUT_PROMPT-FILE": "-",
    });
    assert.equal(inputs.promptFile, promptFile);
  });
});

test("attachment parser preserves first equals, whitespace, order, and duplicates", () => {
  const workspace = path.resolve("/workspace");
  assert.deepEqual(
    parseAttachments(" text/plain = a=b \ntext/plain=x\n", workspace),
    [
      { mediaType: " text/plain ", path: path.join(workspace, " a=b ") },
      { mediaType: "text/plain", path: path.join(workspace, "x") },
    ],
  );
  for (const malformed of [
    "",
    "\n",
    "a",
    "=b",
    "a=",
    "a=b\n\n",
    "a=b\rc=d",
    "a=b\r",
  ]) {
    if (malformed === "") {
      assert.deepEqual(parseAttachments(malformed, workspace), []);
    } else {
      assert.throws(
        () => parseAttachments(malformed, workspace),
        (error: unknown) => error instanceof AdapterError,
      );
    }
  }
});

test("max-parallel accepts only exact digit strings in the CLI range", async () => {
  await withWorkspace(async (workspace) => {
    for (const accepted of ["1", "0001", "256", "0256"]) {
      const inputs = await readActionInputs({
        GITHUB_WORKSPACE: workspace,
        INPUT_WORKFLOW: "workflow.yaml",
        "INPUT_MAX-PARALLEL": accepted,
      });
      assert.equal(inputs.maximumParallel, accepted);
    }
    for (const rejected of ["0", "000", "257", "+1", "1 ", "1.0", "1e2"]) {
      await assert.rejects(
        readActionInputs({
          GITHUB_WORKSPACE: workspace,
          INPUT_WORKFLOW: "workflow.yaml",
          "INPUT_MAX-PARALLEL": rejected,
        }),
        AdapterError,
      );
    }
  });
});

test("child environment removes Action handles and preserves caller authority", () => {
  const child = sanitizedChildEnvironment(
    {
      PATH: "/caller/first:/caller/second",
      INPUT_WORKFLOW: "secret input",
      INPUT_ODD: "undeclared input",
      GITHUB_OUTPUT: "/commands/output",
      GITHUB_ENV: "/commands/env",
      GITHUB_PATH: "/commands/path",
      GITHUB_STATE: "/commands/state",
      GITHUB_STEP_SUMMARY: "/commands/summary",
      SCHERZO_RUN_ACTION_PRIVATE: "private",
      ORDINARY_CALLER_VALUE: "retained",
      GITHUB_TOKEN: "caller-authorized",
    },
    "/verified/cli",
  );
  assert.deepEqual(child, {
    PATH: `/verified/cli${path.delimiter}/caller/first:/caller/second`,
    ORDINARY_CALLER_VALUE: "retained",
    GITHUB_TOKEN: "caller-authorized",
  });
});

test("GitHub outputs use collision-resistant file commands without logging values", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "scherzo-outputs-"));
  try {
    const outputFile = path.join(directory, "output");
    await writeFile(outputFile, "", { mode: 0o600 });
    const outputs = emptyOutputs();
    outputs["export-value"] = "line one\n::warning::not a command\nline three";
    await writeOutputs(outputFile, outputs, () => Buffer.alloc(32, 0xab));
    const bytes = await readFile(outputFile, "utf8");
    assert.match(bytes, /export-value<<scherzo_ab+/u);
    assert.match(bytes, /::warning::not a command/u);
    assert.equal(bytes.includes("undefined"), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("untrusted presentation remains inside one stop-command interval", async () => {
  const log = new PassThrough();
  let logBytes = "";
  log.on("data", (chunk) => (logBytes += chunk.toString()));
  const guard = new WorkflowCommandGuard(log, () => Buffer.alloc(32, 0xcd));
  await guard.start();
  await guard.write(Buffer.from("::set-output name=owned::bad"));
  await guard.stop();
  assert.equal(
    logBytes,
    `::stop-commands::scherzo_${"cd".repeat(32)}\n::set-output name=owned::bad\n::scherzo_${"cd".repeat(32)}::\n`,
  );
});

test("presentation waits for a buffered stop-command marker", async () => {
  const log = new PassThrough();
  let logBytes = "";
  log.on("data", (chunk) => {
    logBytes += chunk.toString();
  });

  log.cork();
  const guard = new WorkflowCommandGuard(log, () => Buffer.alloc(32, 0xab));
  const starting = guard.start();
  const guardedWrite = guard.write(
    Buffer.from("::set-output name=owned::hostile\n"),
  );
  await new Promise<void>((resolve) => process.nextTick(resolve));
  assert.ok(log.writableLength > 0, "the stop marker must still be buffered");
  assert.equal(
    logBytes,
    "",
    "untrusted bytes must not overtake a buffered stop marker",
  );
  log.uncork();
  await starting;
  await guardedWrite;
  await guard.stop();
  assert.equal(
    logBytes,
    `::stop-commands::scherzo_${"ab".repeat(32)}\n::set-output name=owned::hostile\n::scherzo_${"ab".repeat(32)}::\n`,
  );
});
