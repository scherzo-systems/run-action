import { lstat } from "node:fs/promises";
import path from "node:path";

import { AdapterError } from "./errors.ts";
import type { ExecutionAllocation } from "./execution.ts";
import { captureCommand, type CapturedCommand } from "./subprocess.ts";
import type { TerminalEnvelope } from "./terminal.ts";

const MAXIMUM_STATUS_JSON_BYTES = 32 * 1024 * 1024;
const STATUS_KEYS = [
  "schemaVersion",
  "command",
  "outcome",
  "exitStatus",
  "runDirectory",
  "run",
  "state",
  "recovery",
  "retry",
] as const;

export interface ResultIdentity {
  readonly runDirectory: string;
  readonly artifactDirectory: string;
  readonly resultPath: string;
  readonly attemptNumber: number;
  readonly outcome?: "succeeded" | "failed" | "cancelled";
}

export interface CommittedIdentity extends ResultIdentity {
  readonly outcome: "succeeded" | "failed" | "cancelled";
}

export interface RecoveredRun {
  readonly runDirectory: string;
  readonly result?: CommittedIdentity;
}

export interface RecoveryDependencies {
  readonly readStatus: (
    executable: string,
    runDirectory: string,
    environment: NodeJS.ProcessEnv,
  ) => Promise<CapturedCommand>;
}

const DEFAULT_RECOVERY_DEPENDENCIES: RecoveryDependencies = {
  readStatus: (executable, runDirectory, environment) =>
    captureCommand(
      executable,
      ["workflow", "status", runDirectory, "--json"],
      environment,
      MAXIMUM_STATUS_JSON_BYTES,
      "result_identity_invalid",
    ),
};

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
}

async function retainedResult(
  allocation: ExecutionAllocation,
  outcome: CommittedIdentity["outcome"],
): Promise<CommittedIdentity> {
  const artifactDirectory = path.join(
    allocation.runDirectory,
    "attempts",
    "000001",
    "result",
  );
  const resultPath = path.join(artifactDirectory, "result.json");
  const artifactStatus = await lstat(artifactDirectory).catch(() => undefined);
  const resultStatus = await lstat(resultPath).catch(() => undefined);
  if (
    !artifactStatus?.isDirectory() ||
    artifactStatus.isSymbolicLink() ||
    !resultStatus?.isFile() ||
    resultStatus.isSymbolicLink()
  ) {
    throw new AdapterError("result_identity_invalid");
  }
  return {
    runDirectory: allocation.runDirectory,
    artifactDirectory,
    resultPath,
    outcome,
    attemptNumber: 1,
  };
}

export async function recoverRunDirectory(
  allocation: ExecutionAllocation,
  envelope: TerminalEnvelope | undefined,
): Promise<string | undefined> {
  if (envelope?.runDirectory !== allocation.runDirectory) return undefined;
  const runStatus = await lstat(allocation.runDirectory).catch(() => undefined);
  return runStatus?.isDirectory() && !runStatus.isSymbolicLink()
    ? allocation.runDirectory
    : undefined;
}

export async function recoverDurableRun(
  executable: string,
  allocation: ExecutionAllocation,
  environment: NodeJS.ProcessEnv,
  dependencies: RecoveryDependencies = DEFAULT_RECOVERY_DEPENDENCIES,
): Promise<RecoveredRun | undefined> {
  const runStatus = await lstat(allocation.runDirectory).catch(() => undefined);
  if (!runStatus?.isDirectory() || runStatus.isSymbolicLink()) return undefined;

  const status = await dependencies.readStatus(
    executable,
    allocation.runDirectory,
    environment,
  );
  if (
    status.code !== 0 ||
    status.signal !== null ||
    status.stdoutOverflow ||
    status.stderrOverflow
  ) {
    throw new AdapterError("result_identity_invalid");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(status.stdout.toString("utf8"));
  } catch {
    throw new AdapterError("result_identity_invalid");
  }
  const document = record(parsed);
  const run = record(document?.run);
  const state = record(document?.state);
  const attempts = state?.attempts;
  const attempt = Array.isArray(attempts) ? record(attempts[0]) : undefined;
  const result = record(attempt?.result);
  if (
    !document ||
    !exactKeys(document, STATUS_KEYS) ||
    document.schemaVersion !== 1 ||
    document.command !== "scherzo-cloud workflow status" ||
    document.outcome !== "status" ||
    document.exitStatus !== 0 ||
    document.runDirectory !== allocation.runDirectory ||
    !run ||
    run.schemaVersion !== 1 ||
    typeof run.localRunId !== "string" ||
    !state ||
    state.schemaVersion !== 1 ||
    state.localRunId !== run.localRunId ||
    state.currentAttemptNumber !== 1 ||
    !Array.isArray(attempts) ||
    attempts.length !== 1 ||
    !attempt ||
    attempt.attemptNumber !== 1 ||
    attempt.trigger !== "initial" ||
    !result
  ) {
    throw new AdapterError("result_identity_invalid");
  }

  if (result.status !== "published") {
    if (
      result.status !== "not_published" &&
      result.status !== "publication_failed"
    ) {
      throw new AdapterError("result_identity_invalid");
    }
    return { runDirectory: allocation.runDirectory };
  }
  if (result.relativeDirectory !== "attempts/000001/result") {
    throw new AdapterError("result_identity_invalid");
  }
  const outcome =
    attempt.state === "succeeded"
      ? "succeeded"
      : attempt.state === "workflow_failed"
        ? "failed"
        : attempt.state === "cancelled"
          ? "cancelled"
          : undefined;
  if (!outcome) throw new AdapterError("result_identity_invalid");

  return {
    runDirectory: allocation.runDirectory,
    result: await retainedResult(allocation, outcome),
  };
}

export async function committedIdentity(
  allocation: ExecutionAllocation,
  envelope: TerminalEnvelope,
): Promise<CommittedIdentity | undefined> {
  if (
    envelope.outcome !== "succeeded" &&
    envelope.outcome !== "failed" &&
    envelope.outcome !== "cancelled"
  ) {
    return undefined;
  }
  if (
    envelope.runDirectory !== allocation.runDirectory ||
    envelope.attemptNumber === undefined ||
    envelope.resultDirectory === undefined
  ) {
    throw new AdapterError("result_identity_invalid");
  }
  const attemptDirectory = String(envelope.attemptNumber).padStart(6, "0");
  const expectedArtifactDirectory = path.join(
    allocation.runDirectory,
    "attempts",
    attemptDirectory,
    "result",
  );
  if (envelope.resultDirectory !== expectedArtifactDirectory) {
    throw new AdapterError("result_identity_invalid");
  }
  const artifactStatus = await lstat(expectedArtifactDirectory).catch(
    () => undefined,
  );
  const resultPath = path.join(expectedArtifactDirectory, "result.json");
  const resultStatus = await lstat(resultPath).catch(() => undefined);
  if (
    !artifactStatus?.isDirectory() ||
    artifactStatus.isSymbolicLink() ||
    !resultStatus?.isFile() ||
    resultStatus.isSymbolicLink()
  ) {
    throw new AdapterError("result_identity_invalid");
  }
  return {
    runDirectory: allocation.runDirectory,
    artifactDirectory: expectedArtifactDirectory,
    resultPath,
    outcome: envelope.outcome as "succeeded" | "failed" | "cancelled",
    attemptNumber: envelope.attemptNumber,
  };
}
