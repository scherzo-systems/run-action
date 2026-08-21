import { createHash } from "node:crypto";
import { constants as fsConstants, createReadStream } from "node:fs";
import {
  chmod,
  lstat,
  mkdtemp,
  mkdir,
  open,
  readFile,
  realpath,
  rm,
  stat,
} from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import * as tar from "tar-stream";

import { sanitizedChildEnvironment } from "./environment.ts";
import { AdapterError, asAdapterError } from "./errors.ts";
import { appendVerifiedPath } from "./github.ts";
import {
  PINNED_RELEASE,
  selectTarget,
  type ArchiveEvidence,
  type ReleaseEvidence,
} from "./release.ts";
import { captureCommand, type CapturedCommand } from "./subprocess.ts";

const VERSION_OUTPUT_LIMIT = 65_536;

export interface BootstrapResult {
  readonly executable: string;
  readonly cliDirectory: string;
  readonly environment: NodeJS.ProcessEnv;
}

export interface BootstrapDependencies {
  readonly fetch: (url: string) => Promise<Response>;
  readonly runVersion: (
    executable: string,
    environment: NodeJS.ProcessEnv,
  ) => Promise<CapturedCommand>;
  readonly appendPath: (
    file: string | undefined,
    directory: string,
  ) => Promise<void>;
}

export const DEFAULT_BOOTSTRAP_DEPENDENCIES: BootstrapDependencies = {
  fetch: (url) => fetch(url, { redirect: "follow" }),
  runVersion: (executable, environment) =>
    captureCommand(
      executable,
      ["version", "--json"],
      environment,
      VERSION_OUTPUT_LIMIT,
      "bootstrap_version_failed",
    ),
  appendPath: appendVerifiedPath,
};

interface DownloadIdentity {
  readonly size: number;
  readonly sha256: string;
  readonly url: string;
}

async function downloadVerified(
  destination: string,
  identity: DownloadIdentity,
  fetchRelease: (url: string) => Promise<Response>,
): Promise<void> {
  const response = await fetchRelease(identity.url).catch(() => {
    throw new AdapterError("bootstrap_download_failed");
  });
  if (!response.ok || response.body === null) {
    throw new AdapterError("bootstrap_download_failed");
  }
  const contentLength = response.headers.get("content-length");
  if (
    contentLength !== null &&
    (!/^[0-9]+$/u.test(contentLength) ||
      Number(contentLength) !== identity.size)
  ) {
    throw new AdapterError("bootstrap_integrity_failed");
  }

  const handle = await open(
    destination,
    fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY,
    0o600,
  ).catch(() => {
    throw new AdapterError("bootstrap_download_failed");
  });
  const digest = createHash("sha256");
  let bytes = 0;
  try {
    for await (const value of response.body) {
      const chunk = Buffer.from(value);
      bytes += chunk.length;
      if (bytes > identity.size) {
        throw new AdapterError("bootstrap_integrity_failed");
      }
      digest.update(chunk);
      await handle.write(chunk);
    }
    await handle.sync();
  } catch (error) {
    throw error instanceof AdapterError
      ? error
      : new AdapterError("bootstrap_download_failed");
  } finally {
    await handle.close().catch(() => undefined);
  }

  if (bytes !== identity.size || digest.digest("hex") !== identity.sha256) {
    throw new AdapterError("bootstrap_integrity_failed");
  }
}

function verifyChecksumAsset(bytes: Buffer, release: ReleaseEvidence): void {
  if (bytes.includes(0) || !bytes.every((byte) => byte < 0x80)) {
    throw new AdapterError("bootstrap_integrity_failed");
  }
  const text = bytes.toString("ascii");
  if (!text.endsWith("\n")) {
    throw new AdapterError("bootstrap_integrity_failed");
  }
  const lines = text.slice(0, -1).split("\n");
  if (lines.length !== Object.keys(release.archives).length) {
    throw new AdapterError("bootstrap_integrity_failed");
  }

  const observed = new Map<string, string>();
  for (const line of lines) {
    const match = /^([0-9a-f]{64})  ([A-Za-z0-9._-]+)$/u.exec(line);
    if (!match || observed.has(match[2]!)) {
      throw new AdapterError("bootstrap_integrity_failed");
    }
    observed.set(match[2]!, match[1]!);
  }
  for (const archive of Object.values(release.archives)) {
    if (observed.get(archive.name) !== archive.sha256) {
      throw new AdapterError("bootstrap_integrity_failed");
    }
  }
}

function safeTarPath(name: string, directory: boolean): string {
  const candidate = directory && name.endsWith("/") ? name.slice(0, -1) : name;
  const components = candidate.split("/");
  if (
    candidate === "" ||
    candidate.startsWith("/") ||
    candidate.includes("\\") ||
    candidate.includes("\0") ||
    components.some(
      (component) =>
        component === "" || component === "." || component === "..",
    ) ||
    path.posix.normalize(candidate) !== candidate
  ) {
    throw new AdapterError("bootstrap_integrity_failed");
  }
  return candidate;
}

async function extractArchive(
  archivePath: string,
  destination: string,
  archive: ArchiveEvidence,
): Promise<void> {
  const expected = new Map(
    archive.inventory.map((entry) => [entry.path, entry]),
  );
  const seen = new Set<string>();
  const extract = tar.extract();

  extract.on("entry", (header, stream, next) => {
    void (async () => {
      const isDirectory = header.type === "directory";
      const isFile = header.type === "file";
      if (!isDirectory && !isFile) {
        throw new AdapterError("bootstrap_integrity_failed");
      }
      const relative = safeTarPath(header.name, isDirectory);
      const entry = expected.get(relative);
      if (
        !entry ||
        seen.has(relative) ||
        entry.type !== (isDirectory ? "directory" : "file") ||
        header.mode === undefined ||
        entry.mode !== (header.mode & 0o7777) ||
        entry.size !== header.size
      ) {
        throw new AdapterError("bootstrap_integrity_failed");
      }
      seen.add(relative);

      const outputPath = path.join(destination, ...relative.split("/"));
      const confined = path.relative(destination, outputPath);
      if (confined.startsWith("..") || path.isAbsolute(confined)) {
        throw new AdapterError("bootstrap_integrity_failed");
      }

      if (isDirectory) {
        if (header.size !== 0) {
          throw new AdapterError("bootstrap_integrity_failed");
        }
        for await (const chunk of stream) {
          if (Buffer.byteLength(chunk as Uint8Array) !== 0) {
            throw new AdapterError("bootstrap_integrity_failed");
          }
        }
        await mkdir(outputPath, { mode: 0o700 });
        await chmod(outputPath, entry.mode);
      } else {
        const parent = path.dirname(outputPath);
        const parentStatus = await lstat(parent).catch(() => undefined);
        if (!parentStatus?.isDirectory() || parentStatus.isSymbolicLink()) {
          throw new AdapterError("bootstrap_integrity_failed");
        }
        const handle = await open(
          outputPath,
          fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY,
          0o600,
        );
        let written = 0;
        try {
          for await (const value of stream) {
            const chunk = Buffer.from(value as Uint8Array);
            written += chunk.length;
            if (written > entry.size) {
              throw new AdapterError("bootstrap_integrity_failed");
            }
            await handle.write(chunk);
          }
          await handle.sync();
        } finally {
          await handle.close().catch(() => undefined);
        }
        if (written !== entry.size) {
          throw new AdapterError("bootstrap_integrity_failed");
        }
        await chmod(outputPath, entry.mode);
      }
      next();
    })().catch((error: unknown) => extract.destroy(asAdapterError(error)));
  });

  await pipeline(createReadStream(archivePath), createGunzip(), extract).catch(
    () => {
      throw new AdapterError("bootstrap_integrity_failed");
    },
  );
  if (seen.size !== expected.size) {
    throw new AdapterError("bootstrap_integrity_failed");
  }

  for (const entry of archive.inventory) {
    const outputPath = path.join(destination, ...entry.path.split("/"));
    const status = await lstat(outputPath).catch(() => undefined);
    if (
      !status ||
      status.isSymbolicLink() ||
      (entry.type === "file" ? !status.isFile() : !status.isDirectory()) ||
      (status.mode & 0o7777) !== entry.mode ||
      (entry.type === "file" && status.size !== entry.size)
    ) {
      throw new AdapterError("bootstrap_integrity_failed");
    }
  }
}

function exactObjectKeys(value: object, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === [...expected].sort()[index])
  );
}

async function verifyVersion(
  executable: string,
  cliDirectory: string,
  release: ReleaseEvidence,
  sourceEnvironment: NodeJS.ProcessEnv,
  runVersion: BootstrapDependencies["runVersion"],
): Promise<NodeJS.ProcessEnv> {
  const environment = sanitizedChildEnvironment(
    sourceEnvironment,
    cliDirectory,
  );
  const result = await runVersion(executable, environment);
  if (
    result.code !== 0 ||
    result.signal !== null ||
    result.stdoutOverflow ||
    result.stderrOverflow
  ) {
    throw new AdapterError("bootstrap_version_failed");
  }
  let version: unknown;
  try {
    version = JSON.parse(result.stdout.toString("utf8"));
  } catch {
    throw new AdapterError("bootstrap_version_failed");
  }
  const resolvedExecutable = await realpath(executable);
  if (
    typeof version !== "object" ||
    version === null ||
    !exactObjectKeys(version, [
      "schemaVersion",
      "command",
      "version",
      "executablePath",
      "buildIdentity",
    ])
  ) {
    throw new AdapterError("bootstrap_version_failed");
  }
  const record = version as Record<string, unknown>;
  if (
    record.schemaVersion !== 1 ||
    record.command !== "scherzo-cloud" ||
    record.version !== release.version ||
    record.executablePath !== resolvedExecutable ||
    record.buildIdentity !== release.buildIdentity ||
    record.buildIdentity === "unknown"
  ) {
    throw new AdapterError("bootstrap_version_failed");
  }
  return environment;
}

export async function bootstrapCli(
  environment: NodeJS.ProcessEnv,
  dependencies: BootstrapDependencies = DEFAULT_BOOTSTRAP_DEPENDENCIES,
  release: ReleaseEvidence = PINNED_RELEASE,
): Promise<BootstrapResult> {
  const target = selectTarget(environment.RUNNER_OS, environment.RUNNER_ARCH);
  if (!target) {
    throw new AdapterError("bootstrap_platform_unsupported");
  }
  const runnerTemp = environment.RUNNER_TEMP;
  if (!runnerTemp || !path.isAbsolute(runnerTemp)) {
    throw new AdapterError("bootstrap_platform_unsupported");
  }
  const canonicalRunnerTemp = await realpath(runnerTemp).catch(() => undefined);
  const temporaryStatus = canonicalRunnerTemp
    ? await stat(canonicalRunnerTemp).catch(() => undefined)
    : undefined;
  if (!canonicalRunnerTemp || !temporaryStatus?.isDirectory()) {
    throw new AdapterError("bootstrap_platform_unsupported");
  }

  const archive = release.archives[target];
  const allocation = await mkdtemp(
    path.join(canonicalRunnerTemp, ".scherzo-run-cli-"),
  ).catch(() => {
    throw new AdapterError("bootstrap_download_failed");
  });
  const checksumPath = path.join(allocation, release.checksumAsset.name);
  const archivePath = path.join(allocation, archive.name);
  try {
    await chmod(allocation, 0o700);
    await downloadVerified(
      checksumPath,
      release.checksumAsset,
      dependencies.fetch,
    );
    verifyChecksumAsset(await readFile(checksumPath), release);
    await downloadVerified(archivePath, archive, dependencies.fetch);
    await extractArchive(archivePath, allocation, archive);
    await rm(checksumPath, { force: true });
    await rm(archivePath, { force: true });

    const cliDirectory = path.join(allocation, archive.rootDirectory);
    const executable = path.join(cliDirectory, "scherzo-cloud");
    const executableStatus = await lstat(executable).catch(() => undefined);
    if (
      !executableStatus?.isFile() ||
      executableStatus.isSymbolicLink() ||
      (executableStatus.mode & 0o7777) !== 0o755 ||
      (await realpath(executable)) !== executable
    ) {
      throw new AdapterError("bootstrap_integrity_failed");
    }
    const childEnvironment = await verifyVersion(
      executable,
      cliDirectory,
      release,
      environment,
      dependencies.runVersion,
    );
    await dependencies.appendPath(environment.GITHUB_PATH, cliDirectory);
    return { executable, cliDirectory, environment: childEnvironment };
  } catch (error) {
    await rm(allocation, { recursive: true, force: true }).catch(
      () => undefined,
    );
    throw asAdapterError(error);
  }
}
