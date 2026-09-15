import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import {
  access,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import test from "node:test";

import {
  allocateExecution,
  cleanupExecution,
  runWorkflow,
  workflowArguments,
  type ExecutionDependencies,
} from "../src/execution.ts";
import type { ActionInputs } from "../src/inputs.ts";

class FakeChild extends EventEmitter {
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  readonly killedWith: NodeJS.Signals[] = [];

  kill(signal: NodeJS.Signals): boolean {
    this.killedWith.push(signal);
    return true;
  }
}

function inputs(workspace: string): ActionInputs {
  return {
    workspace,
    workflow: path.join(workspace, "workflow.yaml"),
    sourceRoot: workspace,
    executionRoot: workspace,
    namedInputs: [
      { name: "emptyItems", kind: "attachments", items: [] },
      {
        name: "fileValue",
        kind: "file",
        mediaType: "application/octet-stream",
        path: path.join(workspace, "data.bin"),
      },
      {
        name: "inlineJson",
        kind: "json",
        source: {
          kind: "inline",
          value: '[1.00e+2, {"escaped":"\\u0061"}]',
        },
      },
      {
        name: "inlineText",
        kind: "text",
        source: { kind: "inline", value: "private text\r\n" },
      },
      {
        name: "orderedItems",
        kind: "attachments",
        items: [
          { mediaType: "image/png", path: path.join(workspace, "one.png") },
          { mediaType: "image/png", path: path.join(workspace, "one.png") },
        ],
      },
      {
        name: "pathJson",
        kind: "json",
        source: { kind: "path", path: path.join(workspace, "-") },
      },
      {
        name: "pathText",
        kind: "text",
        source: { kind: "path", path: path.join(workspace, "notes.txt") },
      },
    ],
    maximumParallel: "0007",
    selectedExport: "report",
  };
}

async function withTemporary(
  callback: (directory: string) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "scherzo-execution-"));
  try {
    await callback(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("one shell-free child drains streams, spools JSON, and forwards one signal", async () => {
  await withTemporary(async (directory) => {
    const workspace = path.join(directory, "workspace");
    const runnerTemp = path.join(directory, "runner-temp");
    await mkdir(workspace);
    await mkdir(runnerTemp);
    const actionInputs = inputs(workspace);
    const allocation = await allocateExecution(
      runnerTemp,
      actionInputs.namedInputs,
    );
    assert.equal((await lstat(allocation.parent)).mode & 0o7777, 0o700);
    assert.deepEqual(
      allocation.inputFiles.map(({ name, kind }) => ({ name, kind })),
      [
        { name: "inlineJson", kind: "json" },
        { name: "inlineText", kind: "text" },
      ],
    );
    assert.equal(
      await readFile(allocation.inputFiles[0]!.path, "utf8"),
      '[1.00e+2, {"escaped":"\\u0061"}]',
    );
    assert.equal(
      await readFile(allocation.inputFiles[1]!.path, "utf8"),
      "private text\r\n",
    );
    for (const input of allocation.inputFiles) {
      assert.equal((await lstat(input.path)).mode & 0o7777, 0o600);
    }
    await assert.rejects(access(allocation.runDirectory));

    const child = new FakeChild();
    const signals = new EventEmitter();
    const presentationStream = new PassThrough();
    let presentationBytes = "";
    presentationStream.on(
      "data",
      (chunk) => (presentationBytes += chunk.toString()),
    );
    let launches = 0;
    let markSpawned: (() => void) | undefined;
    const spawned = new Promise<void>((resolve) => {
      markSpawned = resolve;
    });
    let observed:
      | {
          executable: string;
          arguments_: readonly string[];
          options: Parameters<ExecutionDependencies["spawn"]>[2];
        }
      | undefined;
    const dependencies: ExecutionDependencies = {
      spawn: (executable, arguments_, options) => {
        launches += 1;
        observed = { executable, arguments_, options };
        markSpawned?.();
        return child as never;
      },
      signals,
      presentationStream,
      randomBytes: () => Buffer.alloc(32, 0xef),
      maximumTerminalBytes: 1024,
    };

    const running = runWorkflow(
      "/verified/cli/scherzo-cloud",
      actionInputs,
      allocation,
      { PATH: "/verified/cli:/caller/bin", ORDINARY: "retained" },
      dependencies,
    );
    await spawned;
    signals.emit("SIGINT");
    signals.emit("SIGTERM");
    child.stderr.write("::set-output name=hostile::value\n");
    child.stderr.end("presentation complete\n");
    child.stdout.end('{"schemaVersion":1}\n');
    child.emit("close", 130, null);
    const result = await running;

    assert.equal(launches, 1);
    assert.deepEqual(child.killedWith, ["SIGINT"]);
    assert.equal(result.signalForwarded, "SIGINT");
    assert.equal(result.code, 130);
    assert.equal(result.signal, null);
    assert.equal(result.terminalOverflow, false);
    assert.equal(
      await readFile(result.terminalPath, "utf8"),
      '{"schemaVersion":1}\n',
    );
    assert.equal(
      presentationBytes,
      `::stop-commands::scherzo_${"ef".repeat(32)}\n::set-output name=hostile::value\npresentation complete\n::scherzo_${"ef".repeat(32)}::\n`,
    );
    assert.equal(observed?.executable, "/verified/cli/scherzo-cloud");
    const inlineJsonPath = allocation.inputFiles[0]!.path;
    const inlineTextPath = allocation.inputFiles[1]!.path;
    const expectedArguments = [
      "workflow",
      "run",
      "--source-root",
      workspace,
      "--execution-root",
      workspace,
      "--run-dir",
      allocation.runDirectory,
      "--max-parallel",
      "0007",
      "--json",
      "--input-attachments-empty",
      "emptyItems",
      "--input-file",
      "fileValue",
      "application/octet-stream",
      path.join(workspace, "data.bin"),
      "--input-json-file",
      "inlineJson",
      inlineJsonPath,
      "--input-text-file",
      "inlineText",
      inlineTextPath,
      "--input-attachment",
      "orderedItems",
      "image/png",
      path.join(workspace, "one.png"),
      "--input-attachment",
      "orderedItems",
      "image/png",
      path.join(workspace, "one.png"),
      "--input-json-file",
      "pathJson",
      path.join(workspace, "-"),
      "--input-text-file",
      "pathText",
      path.join(workspace, "notes.txt"),
      path.join(workspace, "workflow.yaml"),
    ];
    assert.deepEqual(observed?.arguments_, expectedArguments);
    assert.deepEqual(
      workflowArguments(actionInputs, allocation),
      expectedArguments,
    );
    assert.equal(
      expectedArguments.some((argument) => argument.includes("private text")),
      false,
    );
    assert.equal(
      expectedArguments.some((argument) => argument.includes("1.00e+2")),
      false,
    );
    assert.equal(observed?.options.shell, false);
    assert.deepEqual(observed?.options.stdio, ["ignore", "pipe", "pipe"]);
    assert.equal(observed?.options.cwd, workspace);
    assert.deepEqual(observed?.options.env, {
      PATH: "/verified/cli:/caller/bin",
      ORDINARY: "retained",
    });

    await mkdir(allocation.runDirectory);
    await writeFile(path.join(allocation.runDirectory, "durable"), "retained");
    await cleanupExecution(allocation);
    for (const input of allocation.inputFiles) {
      await assert.rejects(access(input.path));
    }
    await assert.rejects(access(allocation.terminalPath));
    assert.equal(
      await readFile(path.join(allocation.runDirectory, "durable"), "utf8"),
      "retained",
    );
  });
});

test("cancellation during launch preparation reaches the child only once", async () => {
  await withTemporary(async (directory) => {
    const actionInputs = inputs(directory);
    const allocation = await allocateExecution(
      directory,
      actionInputs.namedInputs,
    );
    const child = new FakeChild();
    const signals = new EventEmitter();
    const cancellation = new AbortController();
    const presentationStream = new PassThrough();
    presentationStream.resume();
    const result = await runWorkflow(
      "/verified/cli",
      actionInputs,
      allocation,
      {},
      {
        spawn: () => {
          // Cancellation reaches the Action before runWorkflow can register its
          // child handlers. A later second signal must not duplicate forwarding.
          cancellation.abort("SIGTERM");
          queueMicrotask(() => {
            signals.emit("SIGINT");
            child.stdout.end();
            child.stderr.end();
            child.emit("close", null, "SIGTERM");
          });
          return child as never;
        },
        signals,
        presentationStream,
        randomBytes: () => Buffer.alloc(32, 0xef),
        maximumTerminalBytes: 1024,
      },
      cancellation.signal,
    );
    assert.deepEqual(child.killedWith, ["SIGTERM"]);
    assert.equal(result.signalForwarded, "SIGTERM");
    signals.emit("SIGTERM");
    assert.deepEqual(child.killedWith, ["SIGTERM"]);
    await cleanupExecution(allocation);
  });
});

test("a symlinked runner temp retains the CLI's normalized run identity", async () => {
  await withTemporary(async (directory) => {
    const physicalTemp = path.join(directory, "physical");
    const runnerTemp = path.join(directory, "runner-temp");
    await mkdir(physicalTemp);
    await symlink(physicalTemp, runnerTemp, "dir");

    const allocation = await allocateExecution(runnerTemp, []);

    assert.equal(
      allocation.runDirectory,
      path.join(await realpath(allocation.parent), "run"),
      "the identity retained by the Action must match the normalized path returned by the CLI",
    );
  });
});

test("an occupied reserved run path is rejected before child launch", async () => {
  await withTemporary(async (directory) => {
    const workspace = path.join(directory, "workspace");
    const runnerTemp = path.join(directory, "runner-temp");
    await mkdir(workspace);
    await mkdir(runnerTemp);
    const allocation = await allocateExecution(runnerTemp, []);
    await mkdir(allocation.runDirectory);
    let launches = 0;
    await assert.rejects(
      runWorkflow(
        "/verified/cli",
        inputs(workspace),
        allocation,
        {},
        {
          spawn: () => {
            launches += 1;
            return new FakeChild() as never;
          },
          signals: new EventEmitter(),
          presentationStream: new PassThrough(),
          randomBytes: () => Buffer.alloc(32, 1),
          maximumTerminalBytes: 4,
        },
      ),
      /allocation_failed/u,
    );
    assert.equal(launches, 0);
  });
});

test("terminal spool is bounded while stdout continues to EOF", async () => {
  await withTemporary(async (directory) => {
    const workspace = path.join(directory, "workspace");
    const runnerTemp = path.join(directory, "runner-temp");
    await mkdir(workspace);
    await mkdir(runnerTemp);
    const allocation = await allocateExecution(runnerTemp, []);
    const child = new FakeChild();
    const signals = new EventEmitter();
    let markSpawned: (() => void) | undefined;
    const spawned = new Promise<void>((resolve) => {
      markSpawned = resolve;
    });
    const dependencies: ExecutionDependencies = {
      spawn: () => {
        markSpawned?.();
        return child as never;
      },
      signals,
      presentationStream: new PassThrough(),
      randomBytes: () => Buffer.alloc(32, 1),
      maximumTerminalBytes: 4,
    };
    const running = runWorkflow(
      "/verified/cli",
      { ...inputs(workspace), namedInputs: [] },
      allocation,
      {},
      dependencies,
    );
    await spawned;
    child.stdout.end("abcdefghij");
    child.stderr.end();
    child.emit("close", 1, null);
    const result = await running;
    assert.equal(result.terminalBytes, 10);
    assert.equal(result.terminalOverflow, true);
    assert.equal(await readFile(result.terminalPath, "utf8"), "abcd");
    await cleanupExecution(allocation);
    await assert.rejects(access(allocation.parent));
  });
});
