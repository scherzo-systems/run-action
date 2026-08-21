import { spawn, type ChildProcessByStdio } from "node:child_process";
import { randomBytes } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import {
  chmod,
  lstat,
  mkdtemp,
  open,
  realpath,
  rm,
  stat,
  type FileHandle,
} from "node:fs/promises";
import type { Readable } from "node:stream";
import path from "node:path";

import { AdapterError, asAdapterError } from "./errors.ts";
import { WorkflowCommandGuard } from "./github.ts";
import type { ActionInputs } from "./inputs.ts";

export const MAXIMUM_TERMINAL_JSON_BYTES = 202_100_000;

type WorkflowChild = ChildProcessByStdio<null, Readable, Readable>;
type ForwardedSignal = "SIGINT" | "SIGTERM";

export interface SignalSource {
  on(signal: ForwardedSignal, listener: () => void): void;
  off(signal: ForwardedSignal, listener: () => void): void;
}

export interface ExecutionDependencies {
  readonly spawn: (
    executable: string,
    arguments_: readonly string[],
    options: {
      readonly cwd: string;
      readonly env: NodeJS.ProcessEnv;
      readonly shell: false;
      readonly stdio: ["ignore", "pipe", "pipe"];
    },
  ) => WorkflowChild;
  readonly signals: SignalSource;
  readonly presentationStream: NodeJS.WritableStream;
  readonly randomBytes: (size: number) => Buffer;
  readonly maximumTerminalBytes: number;
}

export const DEFAULT_EXECUTION_DEPENDENCIES: ExecutionDependencies = {
  spawn: (executable, arguments_, options) =>
    spawn(executable, [...arguments_], options),
  signals: process,
  presentationStream: process.stderr,
  randomBytes,
  maximumTerminalBytes: MAXIMUM_TERMINAL_JSON_BYTES,
};

export interface ExecutionAllocation {
  readonly parent: string;
  readonly runDirectory: string;
  readonly terminalPath: string;
  readonly promptPath?: string;
}

export interface WorkflowProcessResult {
  readonly code: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly terminalPath: string;
  readonly terminalBytes: number;
  readonly terminalOverflow: boolean;
  readonly signalForwarded?: ForwardedSignal;
}

export async function allocateExecution(
  runnerTemp: string | undefined,
  prompt: string | undefined,
): Promise<ExecutionAllocation> {
  if (!runnerTemp || !path.isAbsolute(runnerTemp)) {
    throw new AdapterError("input_invalid");
  }
  const canonicalRunnerTemp = await realpath(runnerTemp).catch(() => undefined);
  const temporaryStatus = canonicalRunnerTemp
    ? await stat(canonicalRunnerTemp).catch(() => undefined)
    : undefined;
  if (!canonicalRunnerTemp || !temporaryStatus?.isDirectory()) {
    throw new AdapterError("input_invalid");
  }

  const parent = await mkdtemp(
    path.join(canonicalRunnerTemp, ".scherzo-run-"),
  ).catch(() => {
    throw new AdapterError("allocation_failed");
  });
  const runDirectory = path.join(parent, "run");
  const terminalPath = path.join(parent, ".terminal.json");
  try {
    await chmod(parent, 0o700);
    const terminalHandle = await open(
      terminalPath,
      fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY,
      0o600,
    );
    try {
      await terminalHandle.sync();
    } finally {
      await terminalHandle.close();
    }
    await chmod(terminalPath, 0o600);
    if (prompt === undefined) {
      return { parent, runDirectory, terminalPath };
    }

    const promptPath = path.join(parent, ".prompt");
    const promptHandle = await open(
      promptPath,
      fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY,
      0o600,
    );
    try {
      await promptHandle.writeFile(Buffer.from(prompt, "utf8"));
      await promptHandle.sync();
    } finally {
      await promptHandle.close();
    }
    await chmod(promptPath, 0o600);
    return { parent, runDirectory, terminalPath, promptPath };
  } catch (error) {
    await rm(parent, { recursive: true, force: true }).catch(() => undefined);
    throw error instanceof AdapterError
      ? error
      : new AdapterError("allocation_failed");
  }
}

export function workflowArguments(
  inputs: ActionInputs,
  allocation: ExecutionAllocation,
): readonly string[] {
  const arguments_ = [
    "workflow",
    "run",
    "--source-root",
    inputs.sourceRoot,
    "--execution-root",
    inputs.executionRoot,
    "--run-dir",
    allocation.runDirectory,
    "--max-parallel",
    inputs.maximumParallel,
    "--json",
  ];
  const promptPath = allocation.promptPath ?? inputs.promptFile;
  if (promptPath !== undefined) {
    arguments_.push("--prompt-file", promptPath);
  }
  for (const attachment of inputs.attachments) {
    arguments_.push("--attachment", attachment.mediaType, attachment.path);
  }
  arguments_.push(inputs.workflow);
  return arguments_;
}

async function spoolStdout(
  stdout: Readable,
  handle: FileHandle,
  maximumBytes: number,
): Promise<{ bytes: number; overflow: boolean }> {
  let bytes = 0;
  let retained = 0;
  let overflow = false;
  let writeFailed = false;
  try {
    for await (const value of stdout) {
      const chunk = Buffer.from(value as Uint8Array);
      bytes += chunk.length;
      const remaining = maximumBytes - retained;
      if (remaining > 0) {
        const selected = chunk.subarray(0, remaining);
        retained += selected.length;
        if (!writeFailed) {
          await handle.write(selected).catch(() => {
            writeFailed = true;
          });
        }
      }
      if (chunk.length > Math.max(remaining, 0)) overflow = true;
    }
    if (!writeFailed) {
      await handle.sync().catch(() => {
        writeFailed = true;
      });
    }
  } finally {
    await handle.close().catch(() => {
      writeFailed = true;
    });
  }
  if (writeFailed) throw new AdapterError("child_output_failed");
  return { bytes, overflow };
}

export async function runWorkflow(
  executable: string,
  inputs: ActionInputs,
  allocation: ExecutionAllocation,
  environment: NodeJS.ProcessEnv,
  dependencies: ExecutionDependencies = DEFAULT_EXECUTION_DEPENDENCIES,
): Promise<WorkflowProcessResult> {
  const arguments_ = workflowArguments(inputs, allocation);
  if (await lstat(allocation.runDirectory).catch(() => undefined)) {
    throw new AdapterError("allocation_failed");
  }
  const spoolHandle = await open(
    allocation.terminalPath,
    fsConstants.O_WRONLY | fsConstants.O_TRUNC | fsConstants.O_NOFOLLOW,
  ).catch(() => {
    throw new AdapterError("child_output_failed");
  });
  const spoolStatus = await spoolHandle.stat().catch(() => undefined);
  if (!spoolStatus?.isFile() || (spoolStatus.mode & 0o7777) !== 0o600) {
    await spoolHandle.close().catch(() => undefined);
    throw new AdapterError("child_output_failed");
  }

  const guard = new WorkflowCommandGuard(
    dependencies.presentationStream,
    dependencies.randomBytes,
  );
  try {
    await guard.start();
  } catch {
    await spoolHandle.close().catch(() => undefined);
    throw new AdapterError("child_output_failed");
  }

  let child: WorkflowChild;
  try {
    child = dependencies.spawn(executable, arguments_, {
      cwd: inputs.workspace,
      env: environment,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    await spoolHandle.close().catch(() => undefined);
    try {
      await guard.stop();
    } catch {
      throw new AdapterError("child_output_failed");
    }
    throw new AdapterError("child_launch_failed");
  }
  let active = true;
  let forwarded: ForwardedSignal | undefined;
  const forward = (signal: ForwardedSignal) => () => {
    if (!active || forwarded !== undefined) return;
    forwarded = signal;
    try {
      child.kill(signal);
    } catch {
      // The child may have crossed its close boundary. The one forwarding attempt is final.
    }
  };
  const onInterrupt = forward("SIGINT");
  const onTerminate = forward("SIGTERM");
  dependencies.signals.on("SIGINT", onInterrupt);
  dependencies.signals.on("SIGTERM", onTerminate);

  const stderrPromise = (async () => {
    for await (const value of child.stderr) {
      await guard.write(Buffer.from(value as Uint8Array));
    }
  })();
  const stdoutPromise = spoolStdout(
    child.stdout,
    spoolHandle,
    dependencies.maximumTerminalBytes,
  );

  try {
    let launchFailed = false;
    const completion = await new Promise<{
      code: number | null;
      signal: NodeJS.Signals | null;
    }>((resolve) => {
      child.once("error", () => {
        launchFailed = true;
      });
      child.once("close", (code, signal) => resolve({ code, signal }));
    });
    active = false;
    const [spool] = await Promise.all([stdoutPromise, stderrPromise]).catch(
      () => {
        throw new AdapterError("child_output_failed");
      },
    );
    if (launchFailed) throw new AdapterError("child_launch_failed");
    return {
      ...completion,
      terminalPath: allocation.terminalPath,
      terminalBytes: spool.bytes,
      terminalOverflow: spool.overflow,
      ...(forwarded === undefined ? {} : { signalForwarded: forwarded }),
    };
  } catch (error) {
    throw asAdapterError(error);
  } finally {
    active = false;
    dependencies.signals.off("SIGINT", onInterrupt);
    dependencies.signals.off("SIGTERM", onTerminate);
    try {
      await guard.stop();
    } catch {
      throw new AdapterError("child_output_failed");
    }
  }
}

export async function cleanupExecution(
  allocation: ExecutionAllocation,
): Promise<void> {
  let failed = false;
  if (allocation.promptPath !== undefined) {
    await rm(allocation.promptPath, { force: true }).catch(() => {
      failed = true;
    });
  }
  await rm(allocation.terminalPath, { force: true }).catch(() => {
    failed = true;
  });
  const runStatus = await lstat(allocation.runDirectory).catch(() => undefined);
  if (!runStatus?.isDirectory() || runStatus.isSymbolicLink()) {
    await rm(allocation.parent, { recursive: true, force: true }).catch(() => {
      failed = true;
    });
    if (await lstat(allocation.parent).catch(() => undefined)) failed = true;
  } else {
    if (
      (allocation.promptPath !== undefined &&
        (await lstat(allocation.promptPath).catch(() => undefined))) ||
      (await lstat(allocation.terminalPath).catch(() => undefined))
    ) {
      failed = true;
    }
  }
  if (failed) throw new AdapterError("cleanup_failed");
}
