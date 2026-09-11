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

test("release evidence is the closed observed v0.32.0 release", () => {
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
        "https://github.com/scherzo-systems/scherzo-cloud-cli/releases/tag/v0.32.0",
      tag: "v0.32.0",
      releaseId: 386748412,
      releaseCommit: "70cda5707c419de3912769f4adeba6805af7c2c6",
      sourceRevision: "8850664b080784c826a410e770092e452a6bd9b7",
      requiredSourceAncestor: "d3abe478b006861330b8998cb8ccfefe28cf7958",
      version: "0.32.0",
      buildIdentity: "8850664b080784c826a410e770092e452a6bd9b7",
      checksumAsset: {
        id: 556305548,
        name: "SHA256SUMS",
        size: 354,
        sha256:
          "5189a1e1624074d3be345770d9717ab7d605dea2446b49fbd76b7a2cbbef31c5",
        url: "https://github.com/scherzo-systems/scherzo-cloud-cli/releases/download/v0.32.0/SHA256SUMS",
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
        556305547,
        "scherzo-cloud-0.32.0-x86_64-unknown-linux-gnu.tar.gz",
        11399162,
        "1b2d873aa50487cb9e283a56b9ed62e2b02e5082ab313b05983452df63001e12",
      ],
      "aarch64-unknown-linux-gnu": [
        556305545,
        "scherzo-cloud-0.32.0-aarch64-unknown-linux-gnu.tar.gz",
        11680652,
        "081ce9df233de3531768d8f2b29babf5ad0af09fde97d72e0e0b2e86c0c2f0d4",
      ],
      "aarch64-apple-darwin": [
        556305531,
        "scherzo-cloud-0.32.0-aarch64-apple-darwin.tar.gz",
        10468837,
        "e11aad4bc5aabe1ba5c47dd6de55097eb6f4bad68a679be8ad1a77b53f322455",
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
