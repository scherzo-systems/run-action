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
    prompt: "private prompt\r\n",
    attachments: [
      { mediaType: "image/png", path: path.join(workspace, "one.png") },
      { mediaType: "image/png", path: path.join(workspace, "one.png") },
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
    const allocation = await allocateExecution(runnerTemp, actionInputs.prompt);
    assert.equal(
      await readFile(allocation.promptPath!, "utf8"),
      actionInputs.prompt,
    );
    assert.equal((await lstat(allocation.parent)).mode & 0o7777, 0o700);
    assert.equal((await lstat(allocation.promptPath!)).mode & 0o7777, 0o600);
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
    assert.deepEqual(
      observed?.arguments_,
      workflowArguments(actionInputs, allocation),
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
    await assert.rejects(access(allocation.promptPath!));
    await assert.rejects(access(allocation.terminalPath));
    assert.equal(
      await readFile(path.join(allocation.runDirectory, "durable"), "utf8"),
      "retained",
    );
  });
});

test("a symlinked runner temp retains the CLI's normalized run identity", async () => {
  await withTemporary(async (directory) => {
    const physicalTemp = path.join(directory, "physical");
    const runnerTemp = path.join(directory, "runner-temp");
    await mkdir(physicalTemp);
    await symlink(physicalTemp, runnerTemp, "dir");

    const allocation = await allocateExecution(runnerTemp, undefined);

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
    const allocation = await allocateExecution(runnerTemp, undefined);
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
    const allocation = await allocateExecution(runnerTemp, undefined);
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
      { ...inputs(workspace), prompt: undefined } as unknown as ActionInputs,
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
