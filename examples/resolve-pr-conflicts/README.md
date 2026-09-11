# Resolve a PR's merge conflicts

Comment `/resolve-conflicts` on a pull request. Codex resolves the merge, Scherzo
runs your checks, and a separate job pushes one merge commit back to the PR.

**Before enabling:** replace the example's Action SHA after this Action refresh
is published and verified. The existing public SHA embeds CLI v0.15.0 and cannot
run this DAG; this Action refresh embeds the fixed CLI v0.32.0.

The bundled Action's no-conflict path has passed with the published CLI v0.32.0
and Codex 0.153.4, without model credentials. A live GitHub/model trial remains
outstanding.

GitHub.com only; open, same-repository PRs and commenters with write access.

## Set it up

1. Copy this example's `.github/`, `.scherzo/`, and `scripts/` directories into
   your repository's **default branch**. All four files are supplied.
2. In [the Scherzo workflow](.scherzo/workflows/resolve-pr-conflicts.yaml), replace
   `npm ci && npm test` with your checks. Keep the final clean-worktree checks.
   Add any needed tools to the GitHub workflow's `resolve` job.
3. Add two repository secrets:
   - `OPENAI_API_KEY` for Codex.
   - `PR_PUBLISH_TOKEN`: a fine-grained GitHub PAT restricted to this repository,
     with **Contents: read and write** and **Pull requests: read**. Give it an
     expiry; do not grant branch-rule bypass rights.
4. Comment exactly `/resolve-conflicts`. Follow the run under **Actions →
   Resolve PR conflicts**, then review the resulting merge commit.

The default checks assume an npm project with a lockfile and a `test` script.
Change the [repair instructions](.scherzo/prompts/resolve-pr-conflicts.md) if your
repository needs additional guidance.

## How it fits together

The interesting part lives in Scherzo:

```text
prepare merge → resolve only if conflicted → run checks → export Git bundle
```

[GitHub Actions](.github/workflows/resolve-pr-conflicts.yml) supplies three jobs:

```text
authorize → resolve → publish
```

Authorization passes one PR snapshot through the Run Action's `prompt` input.
The Scherzo preparation command verifies the checkout, locates the base commit,
configures the Git author, and starts the merge only if it conflicts. Its declared
text output gates the agent. No conflicts means a successful workflow with the
agent and checks skipped and no bundle to publish. GitHub still installs and
authenticates Codex before invoking Scherzo; a no-op makes no model request.

GitHub uploads the available bundle directly from the Run Action's output and
publishes it from a fresh runner. The [local helper](scripts/resolve-pr-conflicts.ts)
has a local-only preparation command as well as GitHub authorization/publication
commands. The DAG currently expects the trusted `automation` checkout alongside
its execution root; importable Scherzo DAGs can replace this packaging later.

GitHub's actions use readable version tags. Only the Scherzo Run Action keeps its
SHA, since it has no version tags yet. Codex stays at `0.153.4`, the qualified
version for CLI v0.32.0 (`>=0.147.0 <0.154.0`); check compatibility before upgrading
either pin. Version tags can move, unlike immutable commit SHAs.

## Why the separate publisher?

The agent never receives the publication token. The publisher starts on a fresh
runner and uses the workflow's original default-branch checkout—not PR code.
With `issue_comment`, checkout selects that event's default-branch commit unless
an explicit PR revision is requested.

The helper imports the bundle into a new bare Git repository without checking out
or executing its tree. It accepts only one merge commit with the selected PR head
and base as its ordered parents. It rechecks both branches before pushing. Git's
`--force-with-lease` supplies the exact-head guard; the parent check proves the
update is a fast-forward, so it cannot discard PR history.

A separate publisher token lets the push trigger normal PR checks, unlike the
built-in `GITHUB_TOKEN`. An existing GitHub App installation token can replace the
PAT. Workflow-file changes may need additional permission and can be rejected.

## Limits and recovery

- No conflicts, a fork, a closed PR, or insufficient commenter permission: skip.
- Failed preparation, resolution, or checks: do not publish. Full-history checkout
  normally supplies the base commit; if a concurrent history rewrite removed it,
  preparation fails rather than fetching with credentials. Inspect before retrying.
- A changed PR or base: reject stale work and invoke the command again. Git cannot
  atomically guard both branches: a base update after the final check can still
  leave the PR behind its base. CI and branch rules remain authoritative.
- A rejected push leaves the PR unchanged. A transport failure can be ambiguous;
  inspect the PR before retrying. There are no automatic retries or rebases.

Only invoke this on PR code you trust with your model credential. Agents and checks
are **not sandboxed**, prompts cannot enforce good repairs, and logs may contain
code and model output. Keep CI and human review in place.

Codex reads the API key from stdin and stores login state in the repair runner's
temporary `CODEX_HOME`. That directory is not cached or uploaded. Only the bundle
is retained as a private run artifact for one day; the complete Scherzo result
stays on the repair runner. Hosted-runner cleanup discards the login state.
