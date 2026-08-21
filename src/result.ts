import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { once } from "node:events";
import path from "node:path";
import streamJson from "stream-json";

import { AdapterError } from "./errors.ts";
import type { ResultIdentity } from "./identity.ts";
import { captureCommand } from "./subprocess.ts";

const { parser } = streamJson;

const MAXIMUM_RESULT_BYTES = 202_027_692;
const MAXIMUM_VALIDATOR_OUTPUT_BYTES = 1_048_576;
export const MAXIMUM_INLINE_EXPORT_BYTES = 65_536;

interface Fingerprint {
  readonly device: number;
  readonly inode: number;
  readonly size: number;
  readonly sha256: string;
}

interface DigestMetadata {
  readonly algorithm?: unknown;
  readonly value?: unknown;
}

interface CarrierMetadata {
  readonly path?: unknown;
  readonly sizeBytes?: unknown;
  readonly digest?: DigestMetadata;
}

interface SelectedExportMetadata {
  readonly state?: unknown;
  readonly kind?: unknown;
  readonly reason?: unknown;
  readonly path?: unknown;
  readonly sizeBytes?: unknown;
  readonly digest?: DigestMetadata;
  readonly carrier?: CarrierMetadata;
}

interface ResultProjection {
  readonly schemaVersion?: unknown;
  readonly attemptNumber?: unknown;
  readonly outcome?: unknown;
  readonly selected?: SelectedExportMetadata;
}

export interface SelectedProjection {
  readonly state: "available" | "unavailable";
  readonly kind?: "file" | "text" | "json" | "git_branch";
  readonly path?: string;
  readonly value?: string;
  readonly failure?: AdapterError;
}

export interface ValidatedResultProjection {
  readonly outcome: "succeeded" | "failed" | "cancelled";
  readonly selected?: SelectedProjection;
}

export type ArtifactValidator = (
  executable: string,
  artifactDirectory: string,
  environment: NodeJS.ProcessEnv,
) => Promise<void>;

export interface ProjectionDependencies {
  readonly validateArtifact: ArtifactValidator;
  readonly afterValidation?: () => Promise<void>;
}

function exactKeys(value: object, expected: readonly string[]): boolean {
  const expectedKeys = [...expected].sort();
  const actual = Object.keys(value).sort();
  return (
    actual.length === expectedKeys.length &&
    actual.every((key, index) => key === expectedKeys[index])
  );
}

export const validateArtifactWithCli: ArtifactValidator = async (
  executable,
  artifactDirectory,
  environment,
) => {
  const result = await captureCommand(
    executable,
    ["artifact", "validate", "--json", artifactDirectory],
    environment,
    MAXIMUM_VALIDATOR_OUTPUT_BYTES,
    "artifact_validation_failed",
  );
  if (
    result.code !== 0 ||
    result.signal !== null ||
    result.stdoutOverflow ||
    result.stderrOverflow
  ) {
    throw new AdapterError("artifact_validation_failed");
  }
  let document: unknown;
  try {
    document = JSON.parse(result.stdout.toString("utf8"));
  } catch {
    throw new AdapterError("artifact_validation_failed");
  }
  if (
    typeof document !== "object" ||
    document === null ||
    !exactKeys(document, [
      "schemaVersion",
      "command",
      "outcome",
      "exitStatus",
      "artifactSetVersion",
      "artifactDirectory",
      "summary",
    ])
  ) {
    throw new AdapterError("artifact_validation_failed");
  }
  const record = document as Record<string, unknown>;
  const summary = record.summary;
  if (
    record.schemaVersion !== 1 ||
    record.command !== "scherzo-cloud artifact validate" ||
    record.outcome !== "valid" ||
    record.exitStatus !== 0 ||
    record.artifactSetVersion !== 1 ||
    record.artifactDirectory !== (await realpath(artifactDirectory)) ||
    typeof summary !== "object" ||
    summary === null ||
    !exactKeys(summary, [
      "declaredExports",
      "availableExports",
      "unavailableExports",
      "referencedCarriers",
      "carrierBytes",
    ]) ||
    !Object.values(summary).every(
      (value) =>
        typeof value === "number" && Number.isSafeInteger(value) && value >= 0,
    )
  ) {
    throw new AdapterError("artifact_validation_failed");
  }
};

async function fingerprintResult(file: string): Promise<Fingerprint> {
  const handle = await open(
    file,
    fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
  ).catch(() => {
    throw new AdapterError("result_projection_failed");
  });
  const digest = createHash("sha256");
  let size = 0;
  let before;
  let after;
  try {
    before = await handle.stat();
    if (!before.isFile()) throw new AdapterError("result_projection_failed");
    const stream = handle.createReadStream({ autoClose: false });
    for await (const value of stream) {
      const chunk = Buffer.from(value as Uint8Array);
      size += chunk.length;
      if (size > MAXIMUM_RESULT_BYTES) {
        throw new AdapterError("result_projection_failed");
      }
      digest.update(chunk);
    }
    after = await handle.stat();
  } finally {
    await handle.close().catch(() => undefined);
  }
  if (
    !before ||
    !after ||
    before.dev !== after.dev ||
    before.ino !== after.ino ||
    before.size !== after.size ||
    before.mtimeMs !== after.mtimeMs ||
    size !== after.size
  ) {
    throw new AdapterError("result_projection_failed");
  }
  return {
    device: after.dev,
    inode: after.ino,
    size,
    sha256: digest.digest("hex"),
  };
}

interface JsonToken {
  readonly name: string;
  readonly value?: unknown;
}

function primitiveValue(token: JsonToken): unknown {
  if (token.name !== "numberValue") return token.value;
  if (typeof token.value !== "string") {
    throw new AdapterError("result_projection_failed");
  }
  if (!/^-?(?:0|[1-9][0-9]*)$/u.test(token.value)) {
    throw new AdapterError("result_projection_failed");
  }
  const value = Number(token.value);
  if (!Number.isSafeInteger(value)) {
    throw new AdapterError("result_projection_failed");
  }
  return value;
}

const PRIMITIVE_TOKENS = new Set([
  "stringValue",
  "numberValue",
  "nullValue",
  "trueValue",
  "falseValue",
]);

function assignPrimitive(
  projection: ResultProjection,
  selected: SelectedExportMetadata,
  section: "selected" | "digest" | "carrier" | "carrierDigest",
  key: string,
  value: unknown,
): void {
  if (section === "selected") {
    (selected as Record<string, unknown>)[key] = value;
  } else if (section === "digest") {
    const digest = selected.digest ?? {};
    (digest as Record<string, unknown>)[key] = value;
    (selected as { digest?: DigestMetadata }).digest = digest;
  } else if (section === "carrier") {
    const carrier = selected.carrier ?? {};
    (carrier as Record<string, unknown>)[key] = value;
    (selected as { carrier?: CarrierMetadata }).carrier = carrier;
  } else {
    const carrier = selected.carrier ?? {};
    const digest = carrier.digest ?? {};
    (digest as Record<string, unknown>)[key] = value;
    (carrier as { digest?: DigestMetadata }).digest = digest;
    (selected as { carrier?: CarrierMetadata }).carrier = carrier;
  }
  void projection;
}

async function parseResultAndFingerprint(
  file: string,
  selectedExport: string | undefined,
): Promise<{ projection: ResultProjection; fingerprint: Fingerprint }> {
  const handle = await open(
    file,
    fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
  ).catch(() => {
    throw new AdapterError("result_projection_failed");
  });
  const digest = createHash("sha256");
  const jsonParser = parser();
  const projection: ResultProjection = {};
  const selected: SelectedExportMetadata = {};
  let selectedFound = false;
  let depth = 0;
  let rootKey: string | undefined;
  let exportKey: string | undefined;
  let selectedDepth: number | undefined;
  let section: "selected" | "digest" | "carrier" | "carrierDigest" = "selected";
  let sectionDepth = 0;
  let selectedKey: string | undefined;
  const rootValues = new Map<string, unknown>();
  let exportsDepth: number | undefined;

  const consume = (async () => {
    for await (const raw of jsonParser) {
      const token = raw as JsonToken;
      if (token.name === "keyValue") {
        if (depth === 1 && typeof token.value === "string") {
          rootKey = token.value;
        } else if (exportsDepth === depth && typeof token.value === "string") {
          exportKey = token.value;
        } else if (
          selectedDepth !== undefined &&
          depth >= selectedDepth &&
          typeof token.value === "string"
        ) {
          selectedKey = token.value;
        }
        continue;
      }
      if (token.name === "startObject" || token.name === "startArray") {
        const parentDepth = depth;
        depth += 1;
        if (
          parentDepth === 1 &&
          rootKey === "exports" &&
          token.name === "startObject"
        ) {
          exportsDepth = depth;
        } else if (
          exportsDepth === parentDepth &&
          exportKey === selectedExport &&
          token.name === "startObject"
        ) {
          selectedDepth = depth;
          selectedFound = true;
          section = "selected";
          sectionDepth = depth;
        } else if (
          selectedDepth !== undefined &&
          parentDepth >= selectedDepth
        ) {
          if (section === "selected" && selectedKey === "digest") {
            section = "digest";
            sectionDepth = depth;
          } else if (section === "selected" && selectedKey === "carrier") {
            section = "carrier";
            sectionDepth = depth;
          } else if (section === "carrier" && selectedKey === "digest") {
            section = "carrierDigest";
            sectionDepth = depth;
          }
        }
        rootKey = undefined;
        exportKey = undefined;
        selectedKey = undefined;
        continue;
      }
      if (token.name === "endObject" || token.name === "endArray") {
        if (selectedDepth !== undefined && depth === sectionDepth) {
          if (section === "carrierDigest") {
            section = "carrier";
            sectionDepth = selectedDepth + 1;
          } else {
            section = "selected";
            sectionDepth = selectedDepth;
          }
        }
        if (selectedDepth !== undefined && depth === selectedDepth) {
          selectedDepth = undefined;
        }
        if (exportsDepth !== undefined && depth === exportsDepth)
          exportsDepth = undefined;
        depth -= 1;
        continue;
      }
      if (PRIMITIVE_TOKENS.has(token.name)) {
        if (depth === 1 && rootKey) {
          rootValues.set(rootKey, primitiveValue(token));
          rootKey = undefined;
        } else if (selectedDepth !== undefined && selectedKey) {
          assignPrimitive(
            projection,
            selected,
            section,
            selectedKey,
            primitiveValue(token),
          );
          selectedKey = undefined;
        }
      }
    }
  })();

  let size = 0;
  let before;
  let after;
  try {
    before = await handle.stat();
    if (!before.isFile()) throw new AdapterError("result_projection_failed");
    const stream = handle.createReadStream({ autoClose: false });
    for await (const value of stream) {
      const chunk = Buffer.from(value as Uint8Array);
      size += chunk.length;
      if (size > MAXIMUM_RESULT_BYTES) {
        throw new AdapterError("result_projection_failed");
      }
      digest.update(chunk);
      if (!jsonParser.write(chunk)) await once(jsonParser, "drain");
    }
    jsonParser.end();
    await consume;
    after = await handle.stat();
  } catch {
    jsonParser.destroy();
    throw new AdapterError("result_projection_failed");
  } finally {
    await handle.close().catch(() => undefined);
  }
  if (
    !before ||
    !after ||
    before.dev !== after.dev ||
    before.ino !== after.ino ||
    before.size !== after.size ||
    before.mtimeMs !== after.mtimeMs ||
    size !== after.size
  ) {
    throw new AdapterError("result_projection_failed");
  }
  (projection as { schemaVersion?: unknown }).schemaVersion =
    rootValues.get("schemaVersion");
  (projection as { attemptNumber?: unknown }).attemptNumber =
    rootValues.get("attemptNumber");
  (projection as { outcome?: unknown }).outcome = rootValues.get("outcome");
  if (selectedExport !== undefined && selectedFound) {
    (projection as { selected?: SelectedExportMetadata }).selected = selected;
  }
  return {
    projection,
    fingerprint: {
      device: after.dev,
      inode: after.ino,
      size,
      sha256: digest.digest("hex"),
    },
  };
}

function sameFingerprint(first: Fingerprint, second: Fingerprint): boolean {
  return (
    first.device === second.device &&
    first.inode === second.inode &&
    first.size === second.size &&
    first.sha256 === second.sha256
  );
}

async function readCarrier(
  artifactDirectory: string,
  metadata: CarrierMetadata,
  retainInline: boolean,
): Promise<{ path: string; inline?: Buffer }> {
  if (
    typeof metadata.path !== "string" ||
    typeof metadata.sizeBytes !== "number" ||
    !Number.isSafeInteger(metadata.sizeBytes) ||
    metadata.sizeBytes < 0 ||
    metadata.digest?.algorithm !== "sha256" ||
    typeof metadata.digest.value !== "string"
  ) {
    throw new AdapterError("result_projection_failed");
  }
  const carrierPath = path.resolve(artifactDirectory, metadata.path);
  const relative = path.relative(artifactDirectory, carrierPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new AdapterError("result_projection_failed");
  }
  const parentStatus = await lstat(path.dirname(carrierPath)).catch(
    () => undefined,
  );
  const carrierStatus = await lstat(carrierPath).catch(() => undefined);
  if (
    !parentStatus?.isDirectory() ||
    parentStatus.isSymbolicLink() ||
    !carrierStatus?.isFile() ||
    carrierStatus.isSymbolicLink()
  ) {
    throw new AdapterError("result_projection_failed");
  }

  const handle = await open(
    carrierPath,
    fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
  ).catch(() => {
    throw new AdapterError("result_projection_failed");
  });
  const digest = createHash("sha256");
  const chunks: Buffer[] = [];
  let bytes = 0;
  let before;
  let after;
  try {
    before = await handle.stat();
    const stream = handle.createReadStream({ autoClose: false });
    for await (const value of stream) {
      const chunk = Buffer.from(value as Uint8Array);
      bytes += chunk.length;
      if (bytes > metadata.sizeBytes)
        throw new AdapterError("result_projection_failed");
      digest.update(chunk);
      if (retainInline && metadata.sizeBytes <= MAXIMUM_INLINE_EXPORT_BYTES) {
        chunks.push(chunk);
      }
    }
    after = await handle.stat();
  } finally {
    await handle.close().catch(() => undefined);
  }
  if (
    !before?.isFile() ||
    !after?.isFile() ||
    before.dev !== after.dev ||
    before.ino !== after.ino ||
    before.size !== after.size ||
    before.mtimeMs !== after.mtimeMs ||
    bytes !== metadata.sizeBytes ||
    digest.digest("hex") !== metadata.digest.value
  ) {
    throw new AdapterError("result_projection_failed");
  }
  return {
    path: carrierPath,
    ...(retainInline && metadata.sizeBytes <= MAXIMUM_INLINE_EXPORT_BYTES
      ? { inline: Buffer.concat(chunks) }
      : {}),
  };
}

export async function validateAndProject(
  executable: string,
  identity: ResultIdentity,
  selectedExport: string | undefined,
  environment: NodeJS.ProcessEnv,
  dependencies: ProjectionDependencies = {
    validateArtifact: validateArtifactWithCli,
  },
): Promise<ValidatedResultProjection> {
  const before = await fingerprintResult(identity.resultPath);
  await dependencies.validateArtifact(
    executable,
    identity.artifactDirectory,
    environment,
  );
  await dependencies.afterValidation?.();
  const parsed = await parseResultAndFingerprint(
    identity.resultPath,
    selectedExport,
  );
  if (
    !sameFingerprint(before, parsed.fingerprint) ||
    parsed.projection.schemaVersion !== 1 ||
    parsed.projection.attemptNumber !== identity.attemptNumber ||
    !["succeeded", "failed", "cancelled"].includes(
      String(parsed.projection.outcome),
    ) ||
    (identity.outcome !== undefined &&
      parsed.projection.outcome !== identity.outcome)
  ) {
    throw new AdapterError("result_projection_failed");
  }
  const outcome = parsed.projection.outcome as
    "succeeded" | "failed" | "cancelled";
  if (selectedExport === undefined) return { outcome };
  const selected = parsed.projection.selected;
  if (!selected) throw new AdapterError("result_projection_failed");
  if (selected.state === "unavailable") {
    return { outcome, selected: { state: "unavailable" } };
  }
  if (
    selected.state !== "available" ||
    !["file", "text", "json", "git_branch"].includes(String(selected.kind))
  ) {
    throw new AdapterError("result_projection_failed");
  }
  const kind = selected.kind as "file" | "text" | "json" | "git_branch";
  if (kind === "git_branch" && selected.carrier === undefined) {
    return { outcome, selected: { state: "available", kind } };
  }
  const carrierMetadata: CarrierMetadata =
    kind === "git_branch"
      ? (selected.carrier ?? {})
      : {
          path: selected.path,
          sizeBytes: selected.sizeBytes,
          ...(selected.digest === undefined ? {} : { digest: selected.digest }),
        };
  const carrier = await readCarrier(
    identity.artifactDirectory,
    carrierMetadata,
    kind === "text" || kind === "json",
  );
  if (kind === "file" || kind === "git_branch") {
    return {
      outcome,
      selected: { state: "available", kind, path: carrier.path },
    };
  }
  if (typeof carrierMetadata.sizeBytes !== "number") {
    throw new AdapterError("result_projection_failed");
  }
  if (carrierMetadata.sizeBytes > MAXIMUM_INLINE_EXPORT_BYTES) {
    return {
      outcome,
      selected: {
        state: "available",
        kind,
        path: carrier.path,
        failure: new AdapterError("result_projection_failed"),
      },
    };
  }
  let value: string;
  try {
    value = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      carrier.inline,
    );
  } catch {
    throw new AdapterError("result_projection_failed");
  }
  return {
    outcome,
    selected: { state: "available", kind, path: carrier.path, value },
  };
}
