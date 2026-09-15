import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

import {
  eligible,
  importResolution,
  prepareMerge,
  resolutionBundle,
  unchanged,
} from "../examples/resolve-pr-conflicts/scripts/resolve-pr-conflicts.ts";

const repository = "example/project";
const verifiedRunAction =
  "scherzo-systems/run-action@3926e264752beb8702618f2969fcece5f011d5c2";
const head = "1".repeat(40);
const base = "2".repeat(40);
const pr = {
  state: "open",
  head: { sha: head, ref: "feature", repo: { full_name: repository } },
  base: { sha: base, ref: "main", repo: { full_name: repository } },
};

test("conflict resolver refuses forks, closed PRs, and stale destinations", () => {
  assert.equal(eligible(pr, repository), true);
  assert.equal(eligible({ ...pr, state: "closed" }, repository), false);
  assert.equal(
    eligible({ ...pr, head: { ...pr.head, repo: null } }, repository),
    false,
  );
  assert.equal(
    eligible(
      { ...pr, head: { ...pr.head, repo: { full_name: "fork/project" } } },
      repository,
    ),
    false,
  );
  assert.equal(unchanged(pr, repository, head, base, "feature", "main"), true);
  for (const changed of [
    { ...pr, head: { ...pr.head, sha: "3".repeat(40) } },
    { ...pr, base: { ...pr.base, sha: "3".repeat(40) } },
    { ...pr, head: { ...pr.head, ref: "another-branch" } },
    { ...pr, base: { ...pr.base, ref: "release" } },
  ]) {
    assert.equal(
      unchanged(changed, repository, head, base, "feature", "main"),
      false,
    );
  }
});

function git(cwd: string, args: string[], input?: string): string {
  const result = spawnSync("git", args, {
    cwd,
    input,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      HOME: cwd,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_AUTHOR_NAME: "Fixture",
      GIT_AUTHOR_EMAIL: "fixture@example.invalid",
      GIT_COMMITTER_NAME: "Fixture",
      GIT_COMMITTER_EMAIL: "fixture@example.invalid",
      GIT_AUTHOR_DATE: "2026-01-01T00:00:00Z",
      GIT_COMMITTER_DATE: "2026-01-01T00:00:00Z",
    },
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

test("preparation starts only a conflicting merge and rejects wrong or dirty heads", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "prepare-merge-test-"));
  try {
    git(cwd, ["init", "-b", "main"]);
    const file = path.join(cwd, "example.txt");
    const commit = (text: string) => {
      writeFileSync(file, text);
      git(cwd, ["add", "example.txt"]);
      git(cwd, ["commit", "-m", "Fixture"]);
      return git(cwd, ["rev-parse", "HEAD"]);
    };
    const ancestor = commit("original\n");
    const baseHead = commit("base\n");
    git(cwd, ["checkout", "-b", "pr", ancestor]);
    const request = {
      head: ancestor,
      base: baseHead,
      branch: "pr",
      baseBranch: "main",
    };
    assert.equal(prepareMerge(cwd, request), false);
    assert.equal(git(cwd, ["rev-parse", "HEAD"]), ancestor);
    assert.equal(git(cwd, ["status", "--porcelain"]), "");
    assert.throws(() => prepareMerge(cwd, { ...request, head: baseHead }));
    writeFileSync(file, "uncommitted\n");
    assert.throws(() => prepareMerge(cwd, request));
    const prHead = commit("PR\n");
    assert.throws(() =>
      prepareMerge(cwd, { ...request, head: prHead, base: "f".repeat(40) }),
    );
    assert.equal(prepareMerge(cwd, { ...request, head: prHead }), true);
    assert.equal(git(cwd, ["rev-parse", "HEAD"]), prHead);
    assert.equal(git(cwd, ["rev-parse", "MERGE_HEAD"]), baseHead);
    assert.equal(
      git(cwd, ["diff", "--name-only", "--diff-filter=U"]),
      "example.txt",
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("publisher accepts only the authorized merge graph from a real bundle", () => {
  const root = mkdtempSync(path.join(tmpdir(), "conflict-example-test-"));
  try {
    const source = path.join(root, "source");
    mkdirSync(source);
    git(source, ["init", "--bare"]);
    const tree = git(source, ["mktree"], "");
    const commit = (message: string, parents: string[] = []) =>
      git(source, [
        "commit-tree",
        tree,
        ...parents.flatMap((parent) => ["-p", parent]),
        "-m",
        message,
      ]);
    const ancestor = commit("ancestor");
    const prHead = commit("PR", [ancestor]);
    const baseHead = commit("base", [ancestor]);
    const merge = commit("resolution", [prHead, baseHead]);
    const extra = commit("extra", [prHead]);
    const candidates = [
      { name: "correct", oid: merge, accepted: true },
      {
        name: "ordinary-commit",
        oid: commit("not a merge", [prHead]),
        accepted: false,
      },
      {
        name: "reversed-parents",
        oid: commit("reversed", [baseHead, prHead]),
        accepted: false,
      },
      {
        name: "extra-history",
        oid: commit("extra merge", [extra, baseHead]),
        accepted: false,
      },
      {
        name: "wrong-base",
        oid: commit("wrong base", [prHead, ancestor]),
        accepted: false,
      },
    ];
    for (const candidate of candidates) {
      const destination = path.join(root, candidate.name);
      mkdirSync(destination);
      git(destination, ["init", "--bare"]);
      // Supply precisely the authorized prerequisites to the fresh publisher.
      git(destination, ["fetch", source, prHead, baseHead]);
      git(source, ["update-ref", "refs/scherzo/head", candidate.oid]);
      const bundle = path.join(root, `${candidate.name}.bundle`);
      git(source, [
        "bundle",
        "create",
        bundle,
        "refs/scherzo/head",
        `^${prHead}`,
      ]);
      if (candidate.accepted) {
        assert.equal(
          importResolution(destination, bundle, prHead, baseHead),
          merge,
        );
      } else {
        assert.throws(() =>
          importResolution(destination, bundle, prHead, baseHead),
        );
      }
    }
    const corrupt = path.join(root, "corrupt");
    mkdirSync(corrupt);
    git(corrupt, ["init", "--bare"]);
    assert.throws(() =>
      importResolution(
        corrupt,
        path.join(root, "missing.bundle"),
        prHead,
        baseHead,
      ),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("bundle handoff rejects extra files, directories, and symlinks", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "resolution-handoff-"));
  try {
    assert.throws(() => resolutionBundle(directory));
    const bundle = path.join(directory, "0000-resolution.bundle");
    writeFileSync(bundle, "bundle fixture");
    assert.equal(resolutionBundle(directory), bundle);
    const extra = path.join(directory, "extra");
    writeFileSync(extra, "unexpected");
    assert.throws(() => resolutionBundle(directory));
    rmSync(extra);
    rmSync(bundle);
    mkdirSync(bundle);
    assert.throws(() => resolutionBundle(directory));
    rmSync(bundle, { recursive: true });
    symlinkSync("outside-the-handoff", bundle);
    assert.throws(() => resolutionBundle(directory));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("example gates agent secrets and isolates publication from the PR tree", () => {
  const example = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../examples/resolve-pr-conflicts",
  );
  const workflow = parse(
    readFileSync(
      path.join(example, ".github/workflows/resolve-pr-conflicts.yml"),
      "utf8",
    ),
  ) as {
    on: Record<string, unknown>;
    permissions: Record<string, string>;
    jobs: Record<
      string,
      {
        needs?: string | string[];
        if?: string;
        outputs?: Record<string, string>;
        steps: {
          id?: string;
          if?: string;
          uses?: string;
          run?: string;
          with?: Record<string, string | boolean>;
          env?: Record<string, string>;
        }[];
      }
    >;
  };
  assert.deepEqual(workflow.permissions, {
    contents: "read",
    "pull-requests": "read",
  });
  const { authorize, resolve, publish } = workflow.jobs;
  assert.ok(authorize && resolve && publish);
  assert.equal(resolve.needs, "authorize");
  assert.deepEqual(Object.keys(workflow.on), ["issue_comment"]);
  assert.equal(resolve.if, "needs.authorize.outputs.pr != ''");
  assert.deepEqual(authorize.outputs, {
    pr: "${{ steps.inspect.outputs.pr }}",
  });
  assert.deepEqual(publish.needs, ["authorize", "resolve"]);
  assert.equal(publish.if, "needs.resolve.outputs.artifact != ''");
  const upload = resolve.steps.find((step) => step.id === "upload");
  assert.equal(upload?.with?.path, "${{ steps.repair.outputs.export-path }}");
  assert.equal(
    resolve.outputs?.artifact,
    "${{ steps.upload.outputs.artifact-id }}",
  );
  const download = publish.steps.find((step) =>
    step.uses?.startsWith("actions/download-artifact@"),
  );
  assert.equal(
    download?.with?.["artifact-ids"],
    "${{ needs.resolve.outputs.artifact }}",
  );
  assert.equal(download.with["merge-multiple"], true);
  const repair = resolve.steps.find((step) =>
    step.uses?.startsWith("scherzo-systems/run-action@"),
  );
  assert.ok(repair);
  assert.equal(repair.uses, verifiedRunAction);
  assert.deepEqual(repair.env, {
    CODEX_HOME: "${{ runner.temp }}/codex",
  });
  const login = resolve.steps.find(
    (step) => step.env?.OPENAI_API_KEY === "${{ secrets.OPENAI_API_KEY }}",
  );
  assert.ok(login);
  assert.ok(resolve.steps.indexOf(login) < resolve.steps.indexOf(repair));
  assert.equal(upload?.if, "steps.repair.outputs.export-state == 'available'");
  assert.equal(repair.with?.prompt, "${{ needs.authorize.outputs.pr }}");
  assert.equal(repair.with?.inputs, undefined);
  assert.equal(login.env?.CODEX_HOME, repair.env.CODEX_HOME);
  assert.match(
    login.run ?? "",
    /printenv OPENAI_API_KEY\s*\|\s*codex login --with-api-key/u,
  );
  assert.equal(JSON.stringify(publish).includes("OPENAI_API_KEY"), false);
  assert.equal(JSON.stringify(publish).includes("CODEX_HOME"), false);
  assert.equal(repair.with?.["execution-root"], "pr");
  assert.equal(repair.with?.["source-root"], "automation/.scherzo");
  const publisherCheckout = publish.steps[0];
  assert.ok(publisherCheckout?.with);
  assert.equal(
    publisherCheckout?.with?.ref ?? "${{ github.sha }}",
    "${{ github.sha }}",
  );
  assert.equal(publisherCheckout.with["persist-credentials"], false);
  const publisher = publish.steps.at(-1);
  assert.equal(publisher?.env?.GH_TOKEN, "${{ secrets.PR_PUBLISH_TOKEN }}");
  assert.equal(publisher.env?.PR_SNAPSHOT, "${{ needs.authorize.outputs.pr }}");
  assert.equal(repair.with?.prompt, publisher.env?.PR_SNAPSHOT);
  for (const job of [authorize, resolve]) {
    assert.equal(JSON.stringify(job).includes("PR_PUBLISH_TOKEN"), false);
  }
  const scherzo = parse(
    readFileSync(
      path.join(example, ".scherzo/workflows/resolve-pr-conflicts.yaml"),
      "utf8",
    ),
  ) as {
    inputs?: Record<string, { kind: string }>;
    agentProfiles: { resolver: { harness: { kind: string } } };
    steps: {
      prepare: { inputs: Record<string, { ref: string }> };
      resolve: {
        condition: unknown;
        agent: { message: { text: { ref: string }[] } };
      };
      check: { condition: unknown; outputs: Record<string, { kind: string }> };
    };
    exports: Record<string, { ref: string }>;
  };
  assert.equal(scherzo.inputs, undefined);
  assert.equal(scherzo.agentProfiles.resolver.harness.kind, "codex");
  assert.equal(scherzo.steps.prepare.inputs.pr?.ref, "imports.prompt");
  assert.equal(
    scherzo.steps.resolve.agent.message.text.at(-1)?.ref,
    "imports.prompt",
  );
  assert.deepEqual(scherzo.steps.resolve.condition, {
    equals: [{ ref: "outputs.prepare.needed" }, { value: "true" }],
  });
  assert.deepEqual(scherzo.steps.check.condition, {
    disposition: { node: "resolve", is: "succeeded" },
  });
  assert.equal(scherzo.steps.check.outputs.resolution?.kind, "git_branch");
  assert.equal(scherzo.exports.resolution?.ref, "outputs.check.resolution");

  const staged = parse(
    readFileSync(
      path.join(
        example,
        ".scherzo/staged-named-inputs/resolve-pr-conflicts.yaml",
      ),
      "utf8",
    ),
  ) as typeof scherzo;
  assert.deepEqual(staged.inputs?.request, { kind: "text" });
  assert.equal(staged.steps.prepare.inputs.pr?.ref, "inputs.request");
  assert.equal(
    staged.steps.resolve.agent.message.text.at(-1)?.ref,
    "inputs.request",
  );
});
