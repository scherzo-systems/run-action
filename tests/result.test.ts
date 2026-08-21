import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { appendFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { AdapterError } from "../src/errors.ts";
import type { CommittedIdentity } from "../src/identity.ts";
import {
  MAXIMUM_INLINE_EXPORT_BYTES,
  validateAndProject,
  type ArtifactValidator,
} from "../src/result.ts";

type ExportEntry = Record<string, unknown>;

function digest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function byteEntry(
  kind: "file" | "text" | "json",
  bytes: Buffer,
  carrier = "0001",
) {
  return {
    state: "available",
    kind,
    mediaType:
      kind === "file"
        ? "application/octet-stream"
        : kind === "text"
          ? "text/plain; charset=utf-8"
          : "application/json",
    path: `exports/${carrier}`,
    sizeBytes: bytes.length,
    digest: { algorithm: "sha256", value: digest(bytes) },
  };
}

async function withArtifact(
  exports: Record<string, ExportEntry>,
  carriers: Readonly<Record<string, Buffer>>,
  callback: (fixture: {
    identity: CommittedIdentity;
    artifactDirectory: string;
  }) => Promise<void>,
): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "scherzo-result-"));
  const artifactDirectory = path.join(
    root,
    "run",
    "attempts",
    "000001",
    "result",
  );
  const exportsDirectory = path.join(artifactDirectory, "exports");
  await mkdir(exportsDirectory, { recursive: true });
  for (const [name, bytes] of Object.entries(carriers)) {
    await writeFile(path.join(exportsDirectory, name), bytes);
  }
  const resultPath = path.join(artifactDirectory, "result.json");
  await writeFile(
    resultPath,
    `${JSON.stringify({
      schemaVersion: 1,
      attemptNumber: 1,
      outcome: "succeeded",
      exports,
    })}\n`,
  );
  try {
    await callback({
      artifactDirectory,
      identity: {
        runDirectory: path.join(root, "run"),
        artifactDirectory,
        resultPath,
        outcome: "succeeded",
        attemptNumber: 1,
      },
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

const validValidator =
  (calls: string[]): ArtifactValidator =>
  async (_executable, artifactDirectory) => {
    calls.push(artifactDirectory);
  };

test("projection covers unavailable, file, text, JSON, changed Git, and zero-delta Git", async (t) => {
  const cases: readonly {
    name: string;
    entry: (bytes: Buffer) => ExportEntry;
    bytes?: Buffer;
    expected: (
      artifactDirectory: string,
      bytes: Buffer,
    ) => Record<string, unknown>;
  }[] = [
    {
      name: "unavailable",
      entry: () => ({ state: "unavailable", reason: "source_failed" }),
      expected: () => ({ state: "unavailable" }),
    },
    {
      name: "file",
      bytes: Buffer.from([0, 1, 2]),
      entry: (bytes) => byteEntry("file", bytes),
      expected: (directory) => ({
        state: "available",
        kind: "file",
        path: path.join(directory, "exports", "0001"),
      }),
    },
    {
      name: "text",
      bytes: Buffer.from("line one\nλ\n"),
      entry: (bytes) => byteEntry("text", bytes),
      expected: (directory, bytes) => ({
        state: "available",
        kind: "text",
        path: path.join(directory, "exports", "0001"),
        value: bytes.toString("utf8"),
      }),
    },
    {
      name: "text-with-bom",
      bytes: Buffer.concat([
        Buffer.from([0xef, 0xbb, 0xbf]),
        Buffer.from("retained bom"),
      ]),
      entry: (bytes) => byteEntry("text", bytes),
      expected: (directory, bytes) => ({
        state: "available",
        kind: "text",
        path: path.join(directory, "exports", "0001"),
        value: bytes.toString("utf8"),
      }),
    },
    {
      name: "empty-text",
      bytes: Buffer.alloc(0),
      entry: (bytes) => byteEntry("text", bytes),
      expected: (directory) => ({
        state: "available",
        kind: "text",
        path: path.join(directory, "exports", "0001"),
        value: "",
      }),
    },
    {
      name: "json",
      bytes: Buffer.from('{"a":1,"b":[true]}'),
      entry: (bytes) => byteEntry("json", bytes),
      expected: (directory, bytes) => ({
        state: "available",
        kind: "json",
        path: path.join(directory, "exports", "0001"),
        value: bytes.toString("utf8"),
      }),
    },
    {
      name: "changed-git",
      bytes: Buffer.from("bundle bytes"),
      entry: (bytes) => ({
        state: "available",
        kind: "git_branch",
        artifactVersion: 1,
        objectFormat: "sha1",
        baseOid: "0".repeat(40),
        headOid: "1".repeat(40),
        treeOid: "2".repeat(40),
        carrier: {
          path: "exports/0001",
          mediaType: "application/vnd.git.bundle",
          sizeBytes: bytes.length,
          digest: { algorithm: "sha256", value: digest(bytes) },
        },
      }),
      expected: (directory) => ({
        state: "available",
        kind: "git_branch",
        path: path.join(directory, "exports", "0001"),
      }),
    },
    {
      name: "zero-delta-git",
      entry: () => ({
        state: "available",
        kind: "git_branch",
        artifactVersion: 1,
        objectFormat: "sha1",
        baseOid: "0".repeat(40),
        headOid: "0".repeat(40),
        treeOid: "2".repeat(40),
      }),
      expected: () => ({ state: "available", kind: "git_branch" }),
    },
  ];

  for (const scenario of cases) {
    await t.test(scenario.name, async () => {
      const bytes = scenario.bytes ?? Buffer.alloc(0);
      const hasCarrier = scenario.bytes !== undefined;
      await withArtifact(
        { selected: scenario.entry(bytes) },
        hasCarrier ? { "0001": bytes } : {},
        async ({ identity, artifactDirectory }) => {
          const calls: string[] = [];
          const projected = await validateAndProject(
            "/verified/cli",
            identity,
            "selected",
            {},
            { validateArtifact: validValidator(calls) },
          );
          assert.equal(projected.outcome, "succeeded");
          assert.deepEqual(
            projected.selected,
            scenario.expected(artifactDirectory, bytes),
          );
          assert.deepEqual(calls, [artifactDirectory]);
        },
      );
    });
  }
});

test("inline text projection enforces all three byte boundaries", async (t) => {
  for (const size of [
    MAXIMUM_INLINE_EXPORT_BYTES - 1,
    MAXIMUM_INLINE_EXPORT_BYTES,
    MAXIMUM_INLINE_EXPORT_BYTES + 1,
  ]) {
    await t.test(String(size), async () => {
      const bytes = Buffer.alloc(size, 0x61);
      await withArtifact(
        { selected: byteEntry("text", bytes) },
        { "0001": bytes },
        async ({ identity, artifactDirectory }) => {
          const projected = await validateAndProject(
            "/verified/cli",
            identity,
            "selected",
            {},
            { validateArtifact: validValidator([]) },
          );
          assert.equal(projected.outcome, "succeeded");
          assert.equal(projected.selected?.state, "available");
          assert.equal(projected.selected?.kind, "text");
          assert.equal(
            projected.selected?.path,
            path.join(artifactDirectory, "exports", "0001"),
          );
          if (size <= MAXIMUM_INLINE_EXPORT_BYTES) {
            assert.equal(projected.selected?.value?.length, size);
            assert.equal(projected.selected?.failure, undefined);
          } else {
            assert.equal(projected.selected?.value, undefined);
            assert.equal(
              projected.selected?.failure?.code,
              "result_projection_failed",
            );
          }
        },
      );
    });
  }
});

test("selected export lookup follows result metadata across alias ordinal shifts", async () => {
  const bytes = Buffer.from("shared");
  await withArtifact(
    {
      earlier: byteEntry("text", bytes, "0001"),
      selected: byteEntry("text", bytes, "0001"),
    },
    { "0001": bytes },
    async ({ identity, artifactDirectory }) => {
      const projected = await validateAndProject(
        "/verified/cli",
        identity,
        "selected",
        {},
        { validateArtifact: validValidator([]) },
      );
      assert.equal(
        projected.selected?.path,
        path.join(artifactDirectory, "exports", "0001"),
      );
      assert.equal(projected.selected?.value, "shared");
    },
  );
});

test("validated result supplies a missing recovered outcome", async () => {
  await withArtifact({}, {}, async ({ identity }) => {
    const recovered = {
      runDirectory: identity.runDirectory,
      artifactDirectory: identity.artifactDirectory,
      resultPath: identity.resultPath,
      attemptNumber: identity.attemptNumber,
    };
    const projected = await validateAndProject(
      "/verified/cli",
      recovered,
      undefined,
      {},
      { validateArtifact: validValidator([]) },
    );
    assert.deepEqual(projected, { outcome: "succeeded" });
  });
});

test("an absent exact export fails without guessing a path", async () => {
  await withArtifact({}, {}, async ({ identity }) => {
    await assert.rejects(
      validateAndProject(
        "/verified/cli",
        identity,
        "missing",
        {},
        {
          validateArtifact: validValidator([]),
        },
      ),
      (error: unknown) =>
        error instanceof AdapterError &&
        error.code === "result_projection_failed",
    );
  });
});

test("complete validation failure precedes selected carrier exposure", async () => {
  const bytes = Buffer.from("private export");
  await withArtifact(
    { selected: byteEntry("text", bytes) },
    { "0001": bytes },
    async ({ identity }) => {
      await assert.rejects(
        validateAndProject(
          "/verified/cli",
          identity,
          "selected",
          {},
          {
            validateArtifact: async () => {
              throw new AdapterError("artifact_validation_failed");
            },
          },
        ),
        (error: unknown) =>
          error instanceof AdapterError &&
          error.code === "artifact_validation_failed",
      );
    },
  );
});

test("post-validation metadata and carrier mutation both fail closed", async (t) => {
  const bytes = Buffer.from("immutable");
  await t.test("result metadata", async () => {
    await withArtifact(
      { selected: byteEntry("text", bytes) },
      { "0001": bytes },
      async ({ identity }) => {
        await assert.rejects(
          validateAndProject(
            "/verified/cli",
            identity,
            "selected",
            {},
            {
              validateArtifact: validValidator([]),
              afterValidation: async () => appendFile(identity.resultPath, " "),
            },
          ),
          AdapterError,
        );
      },
    );
  });
  await t.test("selected carrier", async () => {
    await withArtifact(
      { selected: byteEntry("text", bytes) },
      { "0001": bytes },
      async ({ identity, artifactDirectory }) => {
        await assert.rejects(
          validateAndProject(
            "/verified/cli",
            identity,
            "selected",
            {},
            {
              validateArtifact: validValidator([]),
              afterValidation: async () =>
                writeFile(
                  path.join(artifactDirectory, "exports", "0001"),
                  "IMMutable",
                ),
            },
          ),
          AdapterError,
        );
      },
    );
  });
});
