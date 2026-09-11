// Trusted plumbing for the example. Run only from the workflow's default-branch
// checkout, never from the PR checkout. No third-party Node dependencies.
import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

interface PullRequest {
  state: string;
  head: { sha: string; ref: string; repo: { full_name: string } | null };
  base: { sha: string; ref: string; repo: { full_name: string } };
}

interface Snapshot {
  head: string;
  base: string;
  branch: string;
  baseBranch: string;
}

function snapshot(): Snapshot {
  const value = JSON.parse(requireValue("PR_SNAPSHOT")) as Snapshot;
  oid(value.head);
  oid(value.base);
  return value;
}

function requireValue(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function oid(value: string): string {
  if (!/^[0-9a-f]{40}$/u.test(value)) throw new Error("Invalid Git object ID");
  return value;
}

export function eligible(pr: PullRequest, repository: string): boolean {
  return (
    pr.state === "open" &&
    pr.head.repo?.full_name === repository &&
    pr.base.repo.full_name === repository &&
    pr.head.ref !== pr.base.ref
  );
}

export function unchanged(
  pr: PullRequest,
  repository: string,
  head: string,
  base: string,
  branch: string,
  baseBranch: string,
): boolean {
  return (
    eligible(pr, repository) &&
    pr.head.sha === head &&
    pr.base.sha === base &&
    pr.head.ref === branch &&
    pr.base.ref === baseBranch
  );
}

export function assertMerge(parents: string, head: string, base: string): void {
  if (parents !== `${oid(head)} ${oid(base)}`) {
    throw new Error(
      "Resolution must be one merge commit with the authorized PR and base parents",
    );
  }
}

function output(name: string, value: string): void {
  if (/[\r\n]/u.test(value)) throw new Error("Invalid output");
  appendFileSync(requireValue("GITHUB_OUTPUT"), `${name}=${value}\n`);
}

function summary(message: string): void {
  appendFileSync(requireValue("GITHUB_STEP_SUMMARY"), `${message}\n`);
}

async function api<T>(endpoint: string): Promise<T> {
  const response = await fetch(
    `https://api.github.com/repos/${requireValue("GITHUB_REPOSITORY")}/${endpoint}`,
    {
      headers: {
        Authorization: `Bearer ${requireValue("GH_TOKEN")}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(30_000),
      redirect: "error",
    },
  );
  if (!response.ok)
    throw new Error(`GitHub request failed (${response.status})`);
  return (await response.json()) as T;
}

async function pullRequest(): Promise<PullRequest> {
  const number = requireValue("PR_NUMBER");
  if (!/^[1-9][0-9]*$/u.test(number)) throw new Error("Invalid PR number");
  return api<PullRequest>(`pulls/${number}`);
}

// Use a clean Git configuration, including for the untrusted bundle. Never
// execute its tree, hooks, credential helpers, or repository configuration.
function git(cwd: string, args: string[], authenticated = false) {
  const config: Record<string, string> = {
    "core.hooksPath": "/dev/null",
    "credential.helper": "",
    "protocol.file.allow": "always",
    "protocol.ext.allow": "never",
  };
  if (authenticated) {
    config["http.https://github.com/.extraheader"] =
      `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${requireValue("GH_TOKEN")}`).toString("base64")}`;
  }
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    HOME: cwd,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_TERMINAL_PROMPT: "0",
    GIT_CONFIG_COUNT: String(Object.keys(config).length),
  };
  Object.entries(config).forEach(([key, value], index) => {
    env[`GIT_CONFIG_KEY_${index}`] = key;
    env[`GIT_CONFIG_VALUE_${index}`] = value;
  });
  return spawnSync("git", args, {
    cwd,
    env,
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 4 * 1024 * 1024,
  });
}

function checkedGit(
  cwd: string,
  args: string[],
  authenticated = false,
): string {
  const result = git(cwd, args, authenticated);
  // Git errors can include untrusted content. Keep logs content-free.
  if (result.status !== 0) throw new Error(`Git ${args[0]} failed`);
  return result.stdout.trim();
}

async function authorize(): Promise<void> {
  const event = JSON.parse(
    readFileSync(requireValue("GITHUB_EVENT_PATH"), "utf8"),
  ) as {
    action: string;
    issue: { pull_request?: unknown };
    comment: { body: string; user: { login: string } };
  };
  if (
    event.action !== "created" ||
    !event.issue.pull_request ||
    event.comment.body !== "/resolve-conflicts"
  ) {
    throw new Error("Not a resolve-conflicts PR command");
  }
  const access = await api<{ permission: string }>(
    `collaborators/${encodeURIComponent(event.comment.user.login)}/permission`,
  );
  const pr = await pullRequest();
  if (
    !["write", "maintain", "admin"].includes(access.permission) ||
    !eligible(pr, requireValue("GITHUB_REPOSITORY"))
  ) {
    summary(
      "Skipped: this command requires write access and an open, same-repository PR.",
    );
    return;
  }
  output(
    "pr",
    JSON.stringify({
      head: oid(pr.head.sha),
      base: oid(pr.base.sha),
      branch: pr.head.ref,
      baseBranch: pr.base.ref,
    } satisfies Snapshot),
  );
}

// Workflow-owned, local-only preparation. Full-history checkout supplies the
// selected base object; if it is missing, fail rather than fetch using credentials.
export function prepareMerge(cwd: string, { head, base }: Snapshot): boolean {
  oid(head);
  oid(base);
  if (checkedGit(cwd, ["rev-parse", "HEAD"]) !== head)
    throw new Error("Wrong PR checkout");
  if (checkedGit(cwd, ["status", "--porcelain"]) !== "")
    throw new Error("Merge preparation requires a clean checkout");
  checkedGit(cwd, ["cat-file", "-e", `${base}^{commit}`]);
  checkedGit(cwd, ["update-ref", "refs/scherzo/base", base]);
  const probe = git(cwd, ["merge-tree", "--write-tree", head, base]);
  if (probe.status === 0) return false;
  if (probe.status !== 1) throw new Error("Cannot inspect merge conflicts");
  checkedGit(cwd, ["config", "user.name", "Scherzo conflict resolver"]);
  checkedGit(cwd, [
    "config",
    "user.email",
    "scherzo-conflicts@example.invalid",
  ]);
  const merge = git(cwd, ["merge", "--no-ff", "--no-commit", base]);
  if (
    merge.status !== 1 ||
    checkedGit(cwd, ["diff", "--name-only", "--diff-filter=U"]) === ""
  ) {
    throw new Error("Expected an in-progress conflicted merge");
  }
  return true;
}

function prepare(): void {
  const input = path.join(requireValue("SCHERZO_STEP_INPUTS"), "values/pr");
  const pr = JSON.parse(readFileSync(input, "utf8")) as Snapshot;
  const needed = prepareMerge(process.cwd(), pr);
  writeFileSync(".git/scherzo-merge-needed", String(needed));
  if (!needed)
    console.log("No conflicts to resolve. Leaving the PR unchanged.");
}

export function importResolution(
  cwd: string,
  bundle: string,
  head: string,
  base: string,
): string {
  checkedGit(cwd, ["bundle", "verify", bundle]);
  checkedGit(cwd, [
    "-c",
    "fetch.fsckObjects=true",
    "fetch",
    "--no-tags",
    bundle,
    "refs/scherzo/head:refs/scherzo/candidate",
  ]);
  const candidate = oid(
    checkedGit(cwd, ["rev-parse", "refs/scherzo/candidate"]),
  );
  assertMerge(
    checkedGit(cwd, ["show", "-s", "--format=%P", candidate]),
    head,
    base,
  );
  return candidate;
}

export function resolutionBundle(directory: string): string {
  const entries = readdirSync(directory, { withFileTypes: true });
  const entry = entries[0];
  if (entries.length !== 1 || !entry?.isFile()) {
    throw new Error("Expected exactly one Git bundle in the handoff");
  }
  return path.resolve(directory, entry.name);
}

async function publish(): Promise<void> {
  const repository = requireValue("GITHUB_REPOSITORY");
  const { head, base, branch, baseBranch } = snapshot();
  const ensureCurrent = async () => {
    if (
      !unchanged(
        await pullRequest(),
        repository,
        head,
        base,
        branch,
        baseBranch,
      )
    ) {
      throw new Error("PR or base changed. Run /resolve-conflicts again");
    }
  };
  await ensureCurrent();
  const cwd = mkdtempSync(path.join(tmpdir(), "conflict-publisher-"));
  try {
    checkedGit(cwd, ["init", "--bare"]);
    checkedGit(cwd, ["check-ref-format", `refs/heads/${branch}`]);
    const remote = `https://github.com/${repository}.git`;
    checkedGit(cwd, ["fetch", "--no-tags", remote, head, base], true);
    const bundle = resolutionBundle(requireValue("RESOLUTION_DIRECTORY"));
    const candidate = importResolution(cwd, bundle, head, base);
    // The exact first parent above proves this update is a fast-forward from
    // head. The lease is compare-and-swap, not permission to rewrite history.
    await ensureCurrent();
    checkedGit(
      cwd,
      [
        "push",
        `--force-with-lease=refs/heads/${branch}:${head}`,
        remote,
        `${candidate}:refs/heads/${branch}`,
      ],
      true,
    );
    summary(
      "Published one conflict-resolution merge commit. Normal PR checks can now run.",
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    switch (process.argv[2]) {
      case "authorize":
        await authorize();
        break;
      case "prepare":
        await prepare();
        break;
      case "publish":
        await publish();
        break;
      default:
        throw new Error("Expected authorize, prepare, or publish");
    }
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Conflict resolution failed",
    );
    process.exitCode = 1;
  }
}
