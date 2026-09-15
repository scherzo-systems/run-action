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
import { parseNamedInputs, readActionInputs } from "../src/inputs.ts";

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

function rejectsInput(
  document: string,
  workspace = path.resolve("/workspace"),
): void {
  assert.throws(
    () => parseNamedInputs(document, workspace),
    (error: unknown) =>
      error instanceof AdapterError && error.code === "input_invalid",
  );
}

test("named inputs preserve closed forms, lexical JSON, path identity, and byte order", async () => {
  await withWorkspace(async (workspace) => {
    const environment: NodeJS.ProcessEnv = {
      GITHUB_WORKSPACE: workspace,
      INPUT_WORKFLOW: "flows/run.yaml",
      INPUT_INPUTS: `{
        "textPath":{"kind":"text","path":"-"},
        "ordered":{"kind":"attachments","items":[
          {"mediaType":" image/png ","path":"media/a=b.png"},
          {"mediaType":"image/png","path":"media/a=b.png"}
        ]},
        "jsonPath":{"kind":"json","path":"private.json"},
        "fileValue":{"kind":"file","mediaType":"application/octet-stream","path":"data.bin"},
        "emptyItems":{"kind":"attachments","items":[]},
        "textValue":{"kind":"text","value":"  exact prompt\\r\\n"},
        "aZ":{"kind":"json","value":[1.2300e+04, {"escaped":"\\u0061", "empty":null}]},
        "aa":{"kind":"text","value":"last"}
      }`,
      "INPUT_MAX-PARALLEL": "0256",
      INPUT_EXPORT: "Result",
    };
    const inputs = await readActionInputs(environment);
    assert.equal(inputs.workspace, workspace);
    assert.equal(inputs.workflow, path.join(workspace, "flows/run.yaml"));
    assert.equal(inputs.sourceRoot, workspace);
    assert.equal(inputs.executionRoot, workspace);
    assert.equal(inputs.maximumParallel, "0256");
    assert.equal(inputs.selectedExport, "Result");
    assert.deepEqual(inputs.namedInputs, [
      {
        name: "aZ",
        kind: "json",
        source: {
          kind: "inline",
          value: '[1.2300e+04, {"escaped":"\\u0061", "empty":null}]',
        },
      },
      {
        name: "aa",
        kind: "text",
        source: { kind: "inline", value: "last" },
      },
      {
        name: "emptyItems",
        kind: "attachments",
        items: [],
      },
      {
        name: "fileValue",
        kind: "file",
        mediaType: "application/octet-stream",
        path: path.join(workspace, "data.bin"),
      },
      {
        name: "jsonPath",
        kind: "json",
        source: { kind: "path", path: path.join(workspace, "private.json") },
      },
      {
        name: "ordered",
        kind: "attachments",
        items: [
          {
            mediaType: " image/png ",
            path: path.join(workspace, "media/a=b.png"),
          },
          {
            mediaType: "image/png",
            path: path.join(workspace, "media/a=b.png"),
          },
        ],
      },
      {
        name: "textPath",
        kind: "text",
        source: { kind: "path", path: path.join(workspace, "-") },
      },
      {
        name: "textValue",
        kind: "text",
        source: { kind: "inline", value: "  exact prompt\r\n" },
      },
    ]);
  });
});

test("absent, empty, and JSON empty objects select only the empty map", () => {
  const workspace = path.resolve("/workspace");
  for (const document of [undefined, "", "{}", " { \r\n } "]) {
    assert.deepEqual(parseNamedInputs(document, workspace), []);
  }
  rejectsInput("   ", workspace);
});

test("the acquisition grammar rejects malformed, duplicate, unknown, and wrong-kind forms", () => {
  const malformed = [
    "null",
    "[]",
    "true",
    "{",
    "{} false",
    "\ufeff{}",
    '{"Name":{"kind":"text","value":"x"}}',
    '{"name":{"kind":"text","value":"x"},"name":{"kind":"text","value":"y"}}',
    '{"name":{"kind":"json","value":{"a":1,"\\u0061":2}}}',
    '{"name":{"kind":"text","kind":"text","value":"x"}}',
    '{"name":{"kind":"unknown","value":"x"}}',
    '{"name":{"kind":"text","value":null}}',
    '{"name":{"kind":"text","value":"x","path":"x"}}',
    '{"name":{"kind":"text","path":""}}',
    '{"name":{"kind":"json"}}',
    '{"name":{"kind":"json","path":7}}',
    '{"name":{"kind":"file","mediaType":"","path":"x"}}',
    '{"name":{"kind":"file","mediaType":"text/plain","path":"x","extra":true}}',
    '{"name":{"kind":"attachments","items":null}}',
    '{"name":{"kind":"attachments","items":[{"mediaType":"text/plain","path":""}]}}',
    '{"name":{"kind":"attachments","items":[{"mediaType":"text/plain","path":"x","extra":0}]}}',
    '{"name":{"kind":"json","value":"\\ud800"}}',
    `{"name":{"kind":"text","value":"${String.fromCharCode(0xd800)}"}}`,
  ];
  malformed.forEach((document) => rejectsInput(document));
});

test("removed fixed Action inputs reject even empty values", async () => {
  await withWorkspace(async (workspace) => {
    for (const name of [
      "INPUT_PROMPT",
      "INPUT_PROMPT-FILE",
      "INPUT_ATTACHMENTS",
    ]) {
      await assert.rejects(
        readActionInputs({
          GITHUB_WORKSPACE: workspace,
          INPUT_WORKFLOW: "workflow.yaml",
          [name]: "",
        }),
        (error: unknown) =>
          error instanceof AdapterError && error.code === "input_invalid",
      );
    }
  });
});

test("path acquisitions are passed without Action content reads", async () => {
  await withWorkspace(async (workspace) => {
    const source = path.join(workspace, "must-not-be-read");
    await writeFile(source, "private bytes", { mode: 0o000 });
    const inputs = await readActionInputs({
      GITHUB_WORKSPACE: workspace,
      INPUT_WORKFLOW: "workflow.yaml",
      INPUT_INPUTS: JSON.stringify({
        privateValue: { kind: "json", path: "must-not-be-read" },
      }),
    });
    assert.deepEqual(inputs.namedInputs, [
      {
        name: "privateValue",
        kind: "json",
        source: { kind: "path", path: source },
      },
    ]);
  });
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
