import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const verifiedPreviewSha = "deb84786f26c01835c9d3590d3304125ed9d0273";
const verifiedReference = `scherzo-systems/run-action@${verifiedPreviewSha}`;
const workflowPath = path.join(
  packageRoot,
  "examples/nightly-sentry-repair/.github/workflows/nightly-sentry-repair.yml",
);

interface ActionStep {
  id?: string;
  name: string;
  uses?: string;
  run?: string;
  env?: Record<string, string>;
  with?: Record<string, unknown>;
  "continue-on-error"?: boolean;
}

interface ExampleJob {
  needs?: string | string[];
  outputs?: Record<string, string>;
  strategy?: {
    "fail-fast": boolean;
    "max-parallel": number;
    matrix: string;
  };
  steps: ActionStep[];
}

interface ExampleWorkflow {
  on: Record<string, unknown>;
  permissions: Record<string, string>;
  jobs: {
    discover: ExampleJob;
    repair: ExampleJob;
    publish: ExampleJob;
  };
}

function assertVerifiedReference(reference: string): void {
  assert.match(
    reference,
    /^scherzo-systems\/run-action@[0-9a-f]{40}$/u,
    "Run Action references must use one full lowercase mirror SHA",
  );
  assert.equal(
    reference,
    verifiedReference,
    "Run Action references must select the tested first mirror SHA",
  );
}

function collectUses(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(collectUses);
  }
  if (value === null || typeof value !== "object") {
    return [];
  }
  return Object.entries(value).flatMap(([key, nested]) => {
    if (key === "uses") {
      assert.equal(typeof nested, "string");
      return [nested as string];
    }
    return collectUses(nested);
  });
}

function stepById(job: ExampleJob, id: string): ActionStep {
  const step = job.steps.find((candidate) => candidate.id === id);
  assert.ok(step, `missing example step ${id}`);
  return step;
}

function stepByName(job: ExampleJob, name: string): ActionStep {
  const step = job.steps.find((candidate) => candidate.name === name);
  assert.ok(step, `missing example step ${name}`);
  return step;
}

test("customer examples select only the tested immutable mirror revision", async () => {
  const readme = await readFile(path.join(packageRoot, "README.md"), "utf8");
  const example = await readFile(workflowPath, "utf8");
  const references = [...readme, ...example]
    .join("")
    .match(/^\s*uses:\s*(scherzo-systems\/run-action@\S+)\s*$/gmu)
    ?.map((line) => line.trim().replace(/^uses:\s*/u, ""));
  assert.deepEqual(references, [
    verifiedReference,
    verifiedReference,
    verifiedReference,
  ]);
  references.forEach(assertVerifiedReference);
});

test("moving, foreign, illustrative, and malformed Run Action references fail closed", () => {
  const invalidReferences = {
    branch: "scherzo-systems/run-action@main",
    tag: "scherzo-systems/run-action@v1",
    abbreviated: "scherzo-systems/run-action@deb8478",
    monorepo:
      "scherzo-systems/run-action@b3cd2b142d62ed7b8289583603f312e59e88ae26",
    illustrative:
      "scherzo-systems/run-action@0123456789abcdef0123456789abcdef01234567",
    bootstrap:
      "scherzo-systems/run-action@ffb1b386b3cb16f1dfd247d8b94eb97f42a4d6b1",
    uppercase:
      "scherzo-systems/run-action@DEB84786F26C01835C9D3590D3304125ED9D0273",
    malformed:
      "scherzo-systems/run-action@geb84786f26c01835c9d3590d3304125ed9d0273",
    placeholder: "scherzo-systems/run-action@FULL_COMMIT_SHA",
  };
  for (const [kind, reference] of Object.entries(invalidReferences)) {
    assert.throws(
      () => assertVerifiedReference(reference),
      `${kind} reference was accepted`,
    );
  }
});

test("nightly composition keeps setup, bounded repair, and publication caller-owned", async () => {
  const workflow = parse(
    await readFile(workflowPath, "utf8"),
  ) as ExampleWorkflow;
  assert.deepEqual(workflow.permissions, { contents: "read" });
  assert.ok("schedule" in workflow.on);
  assert.ok("workflow_dispatch" in workflow.on);

  const discovery = stepById(workflow.jobs.discover, "discovery");
  assert.equal(
    workflow.jobs.discover.outputs?.matrix,
    "${{ steps.discovery.outputs.export-value }}",
  );
  assert.equal(discovery.uses, verifiedReference);
  assert.deepEqual(discovery.with, {
    workflow: ".scherzo/workflows/discover-sentry-issues.yaml",
    "source-root": ".scherzo",
    "execution-root": ".",
    export: "issueMatrix",
  });
  assert.deepEqual(Object.keys(discovery.env ?? {}).sort(), [
    "OPENAI_API_KEY",
    "SENTRY_AUTH_TOKEN",
    "SENTRY_ORG_SLUG",
    "SENTRY_PROJECT_SLUG",
  ]);

  const repairJob = workflow.jobs.repair;
  assert.equal(repairJob.needs, "discover");
  assert.deepEqual(repairJob.strategy, {
    "fail-fast": false,
    "max-parallel": 2,
    matrix: "${{ fromJSON(needs.discover.outputs.matrix) }}",
  });
  const repair = stepById(repairJob, "repair");
  assert.equal(repair.uses, verifiedReference);
  assert.deepEqual(Object.keys(repair.env ?? {}), ["OPENAI_API_KEY"]);
  assert.equal(repair.with?.export, "changes");
  assert.equal(repair.with?.prompt, "${{ toJSON(matrix.issue) }}");
  assert.equal(repair.with?.inputs, undefined);

  const checkout = repairJob.steps[0];
  assert.ok(checkout);
  assert.equal(checkout.uses?.startsWith("actions/checkout@"), true);
  assert.equal(checkout.with?.["fetch-depth"], 0);
  assert.equal(checkout.with?.["persist-credentials"], false);
  const gitAuthor = stepByName(
    repairJob,
    "Configure the caller-selected Git author",
  );
  assert.ok(
    repairJob.steps.indexOf(gitAuthor) < repairJob.steps.indexOf(repair),
  );
  assert.match(gitAuthor.run ?? "", /git config --local user\.name/u);
  assert.match(gitAuthor.run ?? "", /git config --local user\.email/u);
  for (const job of [workflow.jobs.discover, repairJob]) {
    assert.match(
      stepByName(job, "Install the caller-selected Pi harness").run ?? "",
      /@earendil-works\/pi-coding-agent@0\.83\.0/u,
    );
  }
  const exampleReadme = await readFile(
    path.join(packageRoot, "examples/nightly-sentry-repair/README.md"),
    "utf8",
  );
  assert.match(exampleReadme, /@earendil-works\/pi-coding-agent@0\.85\.1/u);

  const sameJob = stepByName(
    repairJob,
    "Verify same-job result and retained Git carrier",
  );
  assert.equal(
    sameJob.env?.EXPORT_KIND,
    "${{ steps.repair.outputs.export-kind }}",
  );
  assert.match(sameJob.run ?? "", /test "\$EXPORT_KIND" = git_branch/u);
  assert.equal("GH_TOKEN" in (repair.env ?? {}), false);

  const upload = stepByName(
    repairJob,
    "Retain the Artifact Set for the isolated publisher",
  );
  assert.equal(
    upload.uses,
    "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02",
  );
  assert.equal(upload.with?.["retention-days"], 1);
  assert.equal(upload.with?.["include-hidden-files"], true);

  const publishJob = workflow.jobs.publish;
  assert.deepEqual(publishJob.needs, ["discover", "repair"]);
  assert.deepEqual(publishJob.strategy, {
    "fail-fast": false,
    "max-parallel": 2,
    matrix: "${{ fromJSON(needs.discover.outputs.matrix) }}",
  });
  const publisherCheckout = stepByName(
    publishJob,
    "Check out the immutable caller publisher baseline",
  );
  assert.equal(publisherCheckout.with?.ref, "${{ github.sha }}");
  assert.equal(publisherCheckout.with?.path, "publisher-source");
  assert.equal(publisherCheckout.with?.["persist-credentials"], false);
  const download = stepByName(
    publishJob,
    "Restore the private Artifact Set handoff",
  );
  assert.equal(
    download.uses,
    "actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093",
  );

  const publisher = stepById(publishJob, "publisher");
  assert.ok(
    publishJob.steps.indexOf(publisherCheckout) <
      publishJob.steps.indexOf(publisher),
  );
  assert.ok(
    publishJob.steps.indexOf(download) < publishJob.steps.indexOf(publisher),
  );
  assert.equal(publisher["continue-on-error"], true);
  assert.deepEqual(Object.keys(publisher.env ?? {}).sort(), [
    "ARTIFACT_SET_PATH",
    "GH_TOKEN",
    "INDUCE_PUBLISHER_FAILURE",
    "SCHERZO_PUBLISHER_ATTESTATION_PATH",
  ]);
  assert.match(
    publisher.env?.GH_TOKEN ?? "",
    /deliberately-invalid.*REPAIR_PUBLISHER_GITHUB_TOKEN/u,
  );
  assert.match(
    publisher.run ?? "",
    /\.\/publisher-source\/scripts\/publish-scherzo-branch/u,
  );
  assert.equal((publisher.run ?? "").includes("./scripts/"), false);
  assert.match(publisher.run ?? "", /"requestAttempted": True/u);
  assert.match(publisher.run ?? "", /"outcome": "authorization_denied"/u);
  const isolation = stepByName(
    publishJob,
    "Verify publisher outcome and local result isolation",
  );
  assert.match(isolation.run ?? "", /"requestAttempted": True/u);
  assert.match(isolation.run ?? "", /"outcome": "authorization_denied"/u);

  const uses = collectUses(workflow);
  uses.forEach((reference) => {
    assert.match(reference, /^[^@\s]+@[0-9a-f]{40}$/u);
  });
  assert.equal(
    uses.some((reference) => reference.startsWith("actions/upload-artifact@")),
    true,
  );
  assert.equal(
    uses.some((reference) =>
      reference.startsWith("actions/download-artifact@"),
    ),
    true,
  );
});

test("Sentry working and staged workflows preserve their paired contracts", async () => {
  const discovery = parse(
    await readFile(
      path.join(
        packageRoot,
        "examples/nightly-sentry-repair/.scherzo/workflows/discover-sentry-issues.yaml",
      ),
      "utf8",
    ),
  ) as {
    agentProfiles: Record<
      string,
      {
        harness: {
          kind: string;
          config: { model: string; thinking: string };
        };
      }
    >;
    steps: Record<
      string,
      {
        kind: string;
        outputs: Record<
          string,
          { kind: string; from: string; schema?: string }
        >;
      }
    >;
    exports: Record<string, { ref: string }>;
  };
  assert.deepEqual(discovery.agentProfiles.discovery?.harness, {
    kind: "pi",
    config: { model: "openai/gpt-5.4-mini", thinking: "low" },
  });
  assert.equal(discovery.steps.discover?.kind, "agent");
  assert.deepEqual(discovery.steps.discover?.outputs.issueMatrix, {
    kind: "json",
    from: "agent_result",
    schema: "../schemas/sentry-issue-matrix.schema.json",
  });
  assert.deepEqual(discovery.exports.issueMatrix, {
    ref: "outputs.discover.issueMatrix",
  });

  const matrixSchema = JSON.parse(
    await readFile(
      path.join(
        packageRoot,
        "examples/nightly-sentry-repair/.scherzo/schemas/sentry-issue-matrix.schema.json",
      ),
      "utf8",
    ),
  ) as {
    properties: { include: { maxItems: number } };
  };
  assert.equal(matrixSchema.properties.include.maxItems, 10);

  type RepairWorkflow = {
    inputs?: Record<string, { kind: string }>;
    agentProfiles: Record<
      string,
      {
        harness: {
          kind: string;
          config: { model: string; thinking: string };
        };
      }
    >;
    steps: Record<
      string,
      {
        agent?: {
          message: {
            text: { ref?: string }[];
            attachments?: { ref: string }[];
          };
        };
        outputs?: Record<string, { kind: string; from: string }>;
      }
    >;
    exports: Record<string, { ref: string }>;
  };
  const repair = parse(
    await readFile(
      path.join(
        packageRoot,
        "examples/nightly-sentry-repair/.scherzo/workflows/repair-sentry-issue.yaml",
      ),
      "utf8",
    ),
  ) as RepairWorkflow;
  assert.equal(repair.inputs, undefined);
  assert.deepEqual(repair.agentProfiles.repair?.harness, {
    kind: "pi",
    config: { model: "openai/gpt-5.4-mini", thinking: "high" },
  });
  assert.equal(
    repair.steps.repair?.agent?.message.text.at(-1)?.ref,
    "imports.prompt",
  );
  assert.deepEqual(repair.steps.repair?.outputs?.changes, {
    kind: "git_branch",
    from: "workspace",
  });
  assert.deepEqual(repair.exports.changes, {
    ref: "outputs.repair.changes",
  });

  const stagedSource = await readFile(
    path.join(
      packageRoot,
      "examples/nightly-sentry-repair/.scherzo/staged-named-inputs/repair-sentry-issue.yaml",
    ),
    "utf8",
  );
  const staged = parse(stagedSource) as RepairWorkflow;
  assert.deepEqual(staged.inputs?.request, { kind: "json" });
  assert.deepEqual(Object.keys(staged.steps), ["repair"]);
  assert.deepEqual(staged.steps.repair?.agent?.message.attachments, [
    { ref: "inputs.request" },
  ]);
  assert.equal(
    staged.steps.repair?.agent?.message.text.some(
      ({ ref }) => ref === "inputs.request",
    ),
    false,
  );
  assert.equal(stagedSource.includes(".scherzo-sentry-request"), false);
  assert.deepEqual(staged.steps.repair?.outputs?.changes, {
    kind: "git_branch",
    from: "workspace",
  });
  assert.deepEqual(staged.exports.changes, {
    ref: "outputs.repair.changes",
  });
});
