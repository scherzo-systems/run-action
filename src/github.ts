import { randomBytes } from "node:crypto";
import { appendFile } from "node:fs/promises";

import { AdapterError } from "./errors.ts";

export const OUTPUT_NAMES = [
  "outcome",
  "run-directory",
  "artifact-set-path",
  "result-path",
  "export-state",
  "export-kind",
  "export-path",
  "export-value",
] as const;

export type OutputName = (typeof OUTPUT_NAMES)[number];
export type ActionOutputs = Record<OutputName, string>;

export function emptyOutputs(): ActionOutputs {
  return Object.fromEntries(
    OUTPUT_NAMES.map((name) => [name, ""]),
  ) as ActionOutputs;
}

export async function appendVerifiedPath(
  githubPathFile: string | undefined,
  cliDirectory: string,
): Promise<void> {
  if (!githubPathFile || /[\r\n]/u.test(cliDirectory)) {
    throw new AdapterError("github_file_command_failed");
  }
  await appendFile(githubPathFile, `${cliDirectory}\n`, {
    encoding: "utf8",
  }).catch(() => {
    throw new AdapterError("github_file_command_failed");
  });
}

export async function writeOutputs(
  githubOutputFile: string | undefined,
  outputs: ActionOutputs,
  random: (size: number) => Buffer = randomBytes,
): Promise<void> {
  if (!githubOutputFile) {
    throw new AdapterError("github_file_command_failed");
  }

  let payload = "";
  for (const name of OUTPUT_NAMES) {
    const value = outputs[name];
    let delimiter: string;
    do {
      delimiter = `scherzo_${random(32).toString("hex")}`;
    } while (value.split(/\r?\n/u).includes(delimiter));
    payload += `${name}<<${delimiter}\n${value}\n${delimiter}\n`;
  }

  await appendFile(githubOutputFile, payload, { encoding: "utf8" }).catch(
    () => {
      throw new AdapterError("github_file_command_failed");
    },
  );
}

export class WorkflowCommandGuard {
  readonly #token: string;
  readonly #stream: NodeJS.WritableStream;
  #active = false;
  #lineStart = true;
  #pending: Promise<void> = Promise.resolve();

  constructor(
    stream: NodeJS.WritableStream,
    random: (size: number) => Buffer = randomBytes,
  ) {
    this.#token = `scherzo_${random(32).toString("hex")}`;
    this.#stream = stream;
  }

  async #write(bytes: Buffer | string): Promise<void> {
    const operation = this.#pending.then(
      () =>
        new Promise<void>((resolve, reject) => {
          const onError = (): void => {
            this.#stream.removeListener("error", onError);
            reject(new AdapterError("child_output_failed"));
          };
          this.#stream.once("error", onError);
          try {
            this.#stream.write(bytes, (error?: Error | null) => {
              this.#stream.removeListener("error", onError);
              if (error) {
                reject(new AdapterError("child_output_failed"));
              } else {
                resolve();
              }
            });
          } catch {
            onError();
          }
        }),
    );
    this.#pending = operation.catch(() => undefined);
    await operation;
  }

  async start(): Promise<void> {
    if (this.#active) return;
    this.#active = true;
    try {
      await this.#write(`::stop-commands::${this.#token}\n`);
    } catch (error) {
      this.#active = false;
      throw error;
    }
  }

  async write(bytes: Buffer): Promise<void> {
    if (!this.#active) {
      throw new AdapterError("child_output_failed");
    }
    await this.#write(bytes);
    if (bytes.length > 0) this.#lineStart = bytes.at(-1) === 0x0a;
  }

  async stop(): Promise<void> {
    if (!this.#active) return;
    try {
      const lineBreak = this.#lineStart ? "" : "\n";
      await this.#write(`${lineBreak}::${this.#token}::\n`);
    } finally {
      this.#active = false;
      this.#lineStart = true;
    }
  }
}
