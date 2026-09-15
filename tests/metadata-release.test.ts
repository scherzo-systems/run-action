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
  "inputs",
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
        steps: {
          uses?: string;
          with?: Record<string, unknown>;
          "continue-on-error"?: boolean;
        }[];
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
  const actionSteps = workflow.jobs.behavior.steps.filter(
    ({ uses }) => uses === "./",
  );
  assert.deepEqual(
    actionSteps.map(
      ({ "continue-on-error": continueOnError }) => continueOnError ?? false,
    ),
    [false, true],
  );
  const namedInputs = JSON.parse(
    String(actionSteps[0]?.with?.inputs),
  ) as Record<string, { kind: string }>;
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(namedInputs).map(([name, input]) => [name, input.kind]),
    ),
    {
      pathText: "text",
      emptyText: "text",
      pathJson: "json",
      inlineJson: "json",
      emptyFile: "file",
      orderedItems: "attachments",
      emptyItems: "attachments",
    },
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

test("release evidence is the closed observed v0.36.0 release", () => {
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
        "https://github.com/scherzo-systems/scherzo-cloud-cli/releases/tag/v0.36.0",
      tag: "v0.36.0",
      releaseId: 388669851,
      releaseCommit: "f665784fccddee8be91d0d12f43b165089dda438",
      sourceRevision: "7da44756c2f611f39c47ee28a697c01f8afe7a6e",
      requiredSourceAncestor: "7215869ca26439d305c097af1dca50ebb8066419",
      version: "0.36.0",
      buildIdentity: "7da44756c2f611f39c47ee28a697c01f8afe7a6e",
      checksumAsset: {
        id: 564106171,
        name: "SHA256SUMS",
        size: 354,
        sha256:
          "b1cd0eb17d23e8a51861f208b714b6fddae21ac6fd061147b789a1594b022fd2",
        url: "https://github.com/scherzo-systems/scherzo-cloud-cli/releases/download/v0.36.0/SHA256SUMS",
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
        564106172,
        "scherzo-cloud-0.36.0-x86_64-unknown-linux-gnu.tar.gz",
        11851127,
        "66cac4647491087297b81a346c9469558d68f22393a2a033ab0d87981dbba96b",
      ],
      "aarch64-unknown-linux-gnu": [
        564106176,
        "scherzo-cloud-0.36.0-aarch64-unknown-linux-gnu.tar.gz",
        12192345,
        "9af8d51c7551063c4ee3c3c7f326905477c00cd7d7598b15e1479c260dff3a14",
      ],
      "aarch64-apple-darwin": [
        564106175,
        "scherzo-cloud-0.36.0-aarch64-apple-darwin.tar.gz",
        10923729,
        "0ff4a7e0382a4e31d7f935d0ebae511e2ac799b9023a0ee5d1574c15406a8771",
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
