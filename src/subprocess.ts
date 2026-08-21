import { spawn } from "node:child_process";

import { AdapterError, type FailureCode } from "./errors.ts";

export interface CapturedCommand {
  readonly code: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stdout: Buffer;
  readonly stdoutOverflow: boolean;
  readonly stderrOverflow: boolean;
}

export async function captureCommand(
  executable: string,
  arguments_: readonly string[],
  environment: NodeJS.ProcessEnv,
  maximumBytes: number,
  failureCode: FailureCode,
): Promise<CapturedCommand> {
  const child = spawn(executable, [...arguments_], {
    env: environment,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const collect = async (
    stream: NodeJS.ReadableStream,
    retain: boolean,
  ): Promise<{ bytes: Buffer; overflow: boolean }> => {
    const chunks: Buffer[] = [];
    let observed = 0;
    let overflow = false;
    for await (const value of stream) {
      const chunk = Buffer.isBuffer(value)
        ? value
        : Buffer.from(
            typeof value === "string" ? value : (value as Uint8Array),
          );
      const remaining = maximumBytes - observed;
      const selected = chunk.subarray(0, Math.max(remaining, 0));
      if (retain && selected.length > 0) chunks.push(selected);
      observed += selected.length;
      if (selected.length < chunk.length) overflow = true;
    }
    return { bytes: Buffer.concat(chunks), overflow };
  };

  const stdoutPromise = collect(child.stdout, true);
  const stderrPromise = collect(child.stderr, false);
  const completion = await new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
  }>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal }));
  }).catch(() => {
    throw new AdapterError(failureCode);
  });
  const [stdout, stderr] = await Promise.all([
    stdoutPromise,
    stderrPromise,
  ]).catch(() => {
    throw new AdapterError(failureCode);
  });
  return {
    ...completion,
    stdout: stdout.bytes,
    stdoutOverflow: stdout.overflow,
    stderrOverflow: stderr.overflow,
  };
}
