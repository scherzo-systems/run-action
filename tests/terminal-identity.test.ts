import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { AdapterError } from "../src/errors.ts";
import type { ExecutionAllocation } from "../src/execution.ts";
import {
  committedIdentity,
  recoverDurableRun,
  recoverRunDirectory,
} from "../src/identity.ts";
import {
  readTerminalEnvelope,
  validateTerminalShape,
} from "../src/terminal.ts";

async function withTemporary(
  callback: (directory: string) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "scherzo-terminal-"));
  try {
    await callback(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("published terminal envelope recovers only the reserved committed identity", async () => {
  await withTemporary(async (directory) => {
    const allocation: ExecutionAllocation = {
      parent: directory,
      runDirectory: path.join(directory, "run"),
      terminalPath: path.join(directory, "terminal.json"),
    };
    const artifactDirectory = path.join(
      allocation.runDirectory,
      "attempts",
      "000001",
      "result",
    );
    await mkdir(path.join(artifactDirectory, "exports"), { recursive: true });
    await writeFile(path.join(artifactDirectory, "result.json"), "{}\n");
    await writeFile(
      allocation.terminalPath,
      `${JSON.stringify({
        schemaVersion: 1,
        command: "scherzo-cloud workflow run",
        outcome: "succeeded",
        exitStatus: 0,
        runDirectory: allocation.runDirectory,
        attemptNumber: 1,
        resultDirectory: artifactDirectory,
        result: { nested: { ignored: true } },
      })}\n`,
    );
    const envelope = await readTerminalEnvelope(allocation.terminalPath);
    validateTerminalShape(envelope);
    assert.equal(envelope.attemptNumber, 1);
    assert.deepEqual(await committedIdentity(allocation, envelope), {
      runDirectory: allocation.runDirectory,
      artifactDirectory,
      resultPath: path.join(artifactDirectory, "result.json"),
      outcome: "succeeded",
      attemptNumber: 1,
    });
    assert.equal(
      await recoverRunDirectory(allocation, envelope),
      allocation.runDirectory,
    );
  });
});

test("terminal identity mismatch and unknown root fields fail closed", async () => {
  await withTemporary(async (directory) => {
    const file = path.join(directory, "terminal.json");
    await writeFile(
      file,
      JSON.stringify({
        schemaVersion: 1,
        command: "scherzo-cloud workflow run",
        outcome: "failed",
        exitStatus: 1,
        runDirectory: path.join(directory, "other"),
        attemptNumber: 1,
        resultDirectory: path.join(directory, "other", "result"),
        result: {},
        extra: true,
      }),
    );
    const envelope = await readTerminalEnvelope(file);
    assert.throws(() => validateTerminalShape(envelope), AdapterError);
  });
});

test("bounded parser rejects malformed, duplicate, and non-schema documents", async (t) => {
  await withTemporary(async (directory) => {
    const cases = [
      "[]",
      '{"schemaVersion":1,"schemaVersion":1}',
      '{"schemaVersion":1',
      JSON.stringify({
        schemaVersion: 2,
        command: "scherzo-cloud workflow run",
        outcome: "rejected",
        exitStatus: 1,
      }),
    ];
    for (const [index, contents] of cases.entries()) {
      await t.test(String(index), async () => {
        const file = path.join(directory, `terminal-${index}.json`);
        await writeFile(file, contents);
        await assert.rejects(readTerminalEnvelope(file), AdapterError);
      });
    }
  });
});

test("bare durable markers do not authenticate terminal-less recovery", async () => {
  await withTemporary(async (directory) => {
    const allocation: ExecutionAllocation = {
      parent: directory,
      runDirectory: path.join(directory, "run"),
      terminalPath: path.join(directory, "terminal.json"),
    };
    await mkdir(allocation.runDirectory);
    await writeFile(path.join(allocation.runDirectory, "run.json"), "{}\n");
    await writeFile(path.join(allocation.runDirectory, "state.json"), "{}\n");
    assert.equal(await recoverRunDirectory(allocation, undefined), undefined);
    const artifactDirectory = path.join(
      allocation.runDirectory,
      "attempts",
      "000001",
      "result",
    );
    await mkdir(path.join(artifactDirectory, "exports"), { recursive: true });
    await writeFile(path.join(artifactDirectory, "result.json"), "{}\n");
    let statusReads = 0;
    await assert.rejects(
      recoverDurableRun(
        "/verified/scherzo-cloud",
        allocation,
        {},
        {
          readStatus: async () => {
            statusReads += 1;
            return {
              code: 1,
              signal: null,
              stdout: Buffer.from("{}\n"),
              stdoutOverflow: false,
              stderrOverflow: false,
            };
          },
        },
      ),
      (error: unknown) =>
        error instanceof AdapterError &&
        error.code === "result_identity_invalid",
    );
    assert.equal(statusReads, 1);
  });
});

test("pinned status binds terminal-less recovery to the initial published result", async () => {
  await withTemporary(async (directory) => {
    const allocation: ExecutionAllocation = {
      parent: directory,
      runDirectory: path.join(directory, "run"),
      terminalPath: path.join(directory, "terminal.json"),
    };
    const artifactDirectory = path.join(
      allocation.runDirectory,
      "attempts",
      "000001",
      "result",
    );
    await mkdir(path.join(artifactDirectory, "exports"), { recursive: true });
    await writeFile(path.join(artifactDirectory, "result.json"), "{}\n");
    const localRunId = "52a51f00-96f1-4d6a-aa28-43f0cce8d16f";
    const status = {
      schemaVersion: 1,
      command: "scherzo-cloud workflow status",
      outcome: "status",
      exitStatus: 0,
      runDirectory: allocation.runDirectory,
      run: { schemaVersion: 1, localRunId },
      state: {
        schemaVersion: 1,
        localRunId,
        currentAttemptNumber: 1,
        attempts: [
          {
            attemptNumber: 1,
            trigger: "initial",
            state: "workflow_failed",
            result: {
              status: "published",
              relativeDirectory: "attempts/000001/result",
            },
          },
        ],
      },
      recovery: { status: "settled" },
      retry: { eligible: true },
    };

    const recovered = await recoverDurableRun(
      "/verified/scherzo-cloud",
      allocation,
      { PATH: "/verified" },
      {
        readStatus: async (executable, runDirectory, environment) => {
          assert.equal(executable, "/verified/scherzo-cloud");
          assert.equal(runDirectory, allocation.runDirectory);
          assert.equal(environment.PATH, "/verified");
          return {
            code: 0,
            signal: null,
            stdout: Buffer.from(`${JSON.stringify(status)}\n`),
            stdoutOverflow: false,
            stderrOverflow: false,
          };
        },
      },
    );

    assert.deepEqual(recovered, {
      runDirectory: allocation.runDirectory,
      result: {
        runDirectory: allocation.runDirectory,
        artifactDirectory,
        resultPath: path.join(artifactDirectory, "result.json"),
        outcome: "failed",
        attemptNumber: 1,
      },
    });

    status.state.attempts[0]!.result.relativeDirectory =
      "attempts/000001/other";
    await assert.rejects(
      recoverDurableRun(
        "/verified/scherzo-cloud",
        allocation,
        {},
        {
          readStatus: async () => ({
            code: 0,
            signal: null,
            stdout: Buffer.from(`${JSON.stringify(status)}\n`),
            stdoutOverflow: false,
            stderrOverflow: false,
          }),
        },
      ),
      AdapterError,
    );
  });
});
