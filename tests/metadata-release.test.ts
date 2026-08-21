import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

import evidence from "../release-evidence.json" with { type: "json" };
import { OUTPUT_NAMES } from "../src/github.ts";
import { PINNED_RELEASE } from "../src/release.ts";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const inputNames = [
  "workflow",
  "source-root",
  "execution-root",
  "prompt",
  "prompt-file",
  "attachments",
  "max-parallel",
  "export",
];

test("action.yml exposes only the V1 metadata surface and Node 24 bundle", async () => {
  const metadata = parse(
    await readFile(path.join(packageRoot, "action.yml"), "utf8"),
  ) as {
    inputs: Record<string, unknown>;
    outputs: Record<string, unknown>;
    runs: Record<string, unknown>;
  };
  assert.deepEqual(Object.keys(metadata.inputs), inputNames);
  assert.deepEqual(Object.keys(metadata.outputs), [...OUTPUT_NAMES]);
  assert.deepEqual(metadata.runs, { using: "node24", main: "dist/index.cjs" });
  assert.equal(
    (metadata.inputs.workflow as { required: boolean }).required,
    true,
  );
  for (const name of ["source-root", "execution-root"]) {
    assert.equal(
      (metadata.inputs[name] as { default: string }).default,
      "${{ github.workspace }}",
    );
  }
  assert.equal(
    (metadata.inputs["max-parallel"] as { default: string }).default,
    "1",
  );
});

test("public checks define source and all supported native behavior jobs", async () => {
  const workflow = parse(
    await readFile(
      path.join(packageRoot, ".github/workflows/check.yml"),
      "utf8",
    ),
  ) as {
    permissions: Record<string, string>;
    jobs: {
      source: { name: string; "runs-on": string };
      behavior: {
        name: string;
        "runs-on": string;
        strategy: { matrix: { runner: string[] } };
        steps: { uses?: string; "continue-on-error"?: boolean }[];
      };
    };
  };
  assert.deepEqual(workflow.permissions, { contents: "read" });
  assert.deepEqual(workflow.jobs.source, {
    ...workflow.jobs.source,
    name: "Public source",
    "runs-on": "ubuntu-24.04",
  });
  assert.equal(workflow.jobs.behavior.name, "${{ matrix.runner }}");
  assert.equal(workflow.jobs.behavior["runs-on"], "${{ matrix.runner }}");
  assert.deepEqual(workflow.jobs.behavior.strategy.matrix.runner, [
    "ubuntu-24.04",
    "ubuntu-24.04-arm",
    "macos-15",
  ]);
  assert.deepEqual(
    workflow.jobs.behavior.steps
      .filter(({ uses }) => uses === "./")
      .map(
        ({ "continue-on-error": continueOnError }) => continueOnError ?? false,
      ),
    [false, true],
  );
});

test("traceability accounts for every V1 invariant and requirement", async () => {
  const traceability = JSON.parse(
    await readFile(path.join(packageRoot, "traceability.json"), "utf8"),
  ) as {
    schemaVersion: number;
    invariants: { id: string; owner: string; evidence: string[] }[];
    requirements: { id: string; owner: string; evidence: string[] }[];
  };
  assert.equal(traceability.schemaVersion, 1);
  assert.deepEqual(
    traceability.invariants.map(({ id }) => id),
    Array.from(
      { length: 11 },
      (_, index) => `GHA-RUN-INV-${String(index + 1).padStart(3, "0")}`,
    ),
  );
  assert.deepEqual(
    traceability.requirements.map(({ id }) => id),
    Array.from(
      { length: 31 },
      (_, index) => `GHA-RUN-${String(index + 1).padStart(3, "0")}`,
    ),
  );
  for (const entry of [
    ...traceability.invariants,
    ...traceability.requirements,
  ]) {
    assert.match(
      entry.owner,
      /^(action|artifact-set-delegated|cli-delegated|documentation|mirror|release)$/u,
    );
    assert.ok(entry.evidence.length > 0);
    assert.equal(
      entry.evidence.every((value) => value.length > 0),
      true,
    );
  }
});

test("release evidence is the closed observed v0.15.0 release", () => {
  assert.deepEqual(PINNED_RELEASE, evidence);
  assert.deepEqual(
    {
      repository: evidence.repository,
      releaseUrl: evidence.releaseUrl,
      tag: evidence.tag,
      releaseId: evidence.releaseId,
      releaseCommit: evidence.releaseCommit,
      sourceRevision: evidence.sourceRevision,
      requiredSourceAncestor: evidence.requiredSourceAncestor,
      version: evidence.version,
      buildIdentity: evidence.buildIdentity,
      checksumAsset: evidence.checksumAsset,
    },
    {
      repository: "scherzo-systems/scherzo-cloud-cli",
      releaseUrl:
        "https://github.com/scherzo-systems/scherzo-cloud-cli/releases/tag/v0.15.0",
      tag: "v0.15.0",
      releaseId: 373161961,
      releaseCommit: "a4ff9e99b8fe6c78f1944acf376b65d62842b9ed",
      sourceRevision: "0e849fc9dbd366d57d612923ac3f877a70e70c81",
      requiredSourceAncestor: "d3abe478b006861330b8998cb8ccfefe28cf7958",
      version: "0.15.0",
      buildIdentity: "0e849fc9dbd366d57d612923ac3f877a70e70c81",
      checksumAsset: {
        id: 521014949,
        name: "SHA256SUMS",
        size: 354,
        sha256:
          "94c4b4adb92f4e2f7ea2eb70c88977fbd68ffe37dbaa2de0532f669b22b21cc7",
        url: "https://github.com/scherzo-systems/scherzo-cloud-cli/releases/download/v0.15.0/SHA256SUMS",
      },
    },
  );
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(evidence.archives).map(([target, archive]) => [
        target,
        [archive.id, archive.name, archive.size, archive.sha256],
      ]),
    ),
    {
      "x86_64-unknown-linux-gnu": [
        521014950,
        "scherzo-cloud-0.15.0-x86_64-unknown-linux-gnu.tar.gz",
        9718875,
        "177ce59310314dd1bcbd8f2f31d368d56c59ec7e39fa391de1a2a68c5a41e8c5",
      ],
      "aarch64-unknown-linux-gnu": [
        521014951,
        "scherzo-cloud-0.15.0-aarch64-unknown-linux-gnu.tar.gz",
        9883205,
        "4e705738fd768f64ad9eb0d1b564e5527bcf6474b2804c24a8dec5148bf8ec80",
      ],
      "aarch64-apple-darwin": [
        521014952,
        "scherzo-cloud-0.15.0-aarch64-apple-darwin.tar.gz",
        8900809,
        "6c7baec2865faf05fe6f7b2b4ad74a129f422311100eb1b2bfcb73c928a87b04",
      ],
    },
  );
  const serialized = JSON.stringify(evidence).toLowerCase();
  for (const forbidden of [
    "latest",
    "placeholder",
    "cli-version",
    "source-build",
  ]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});
