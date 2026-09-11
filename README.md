# Scherzo Run Action

Run a checked-in Scherzo workflow inside a GitHub Actions job—without sending the
run to Scherzo Cloud.

Scherzo workflows describe a directed graph of command and AI-agent steps. This
Action lets GitHub provide the runner, trigger, and job environment while Scherzo
coordinates the workflow, captures its declared outputs, and produces one validated
local result.

## Why use it?

Use the Action when you want to:

- keep multi-step automation in a reusable, reviewable workflow instead of a large
  GitHub Actions job;
- combine ordinary repository commands with Pi, Claude Code, or Codex agent steps;
- get a structured outcome and a complete Portable Artifact Set when a terminal result
  commits, including for failed or cancelled workflows;
- pass one declared text, JSON, file, or Git-branch export to later steps; and
- run with an exact, verified Scherzo CLI without installing the CLI separately or
  creating a Scherzo Cloud account.

A typical job checks out a repository, installs any agent harness used by the workflow,
runs this Action, and then chooses what to do with the result. Uploading artifacts,
pushing branches, and opening pull requests remain separate, explicitly credentialed
steps.

## What the Action owns

The Action:

1. downloads the exact Scherzo CLI release pinned by the selected Action revision;
2. verifies the release checksum and CLI build identity;
3. runs exactly one fresh local Workflow V1 invocation;
4. validates the complete Portable Artifact Set; and
5. exposes trustworthy outcome, path, and optional selected-export outputs to later
   steps in the same job.

The caller still owns:

- repository checkout and source preparation;
- every command-line tool used by command steps;
- installation and configuration of any selected agent harness;
- provider, application, Git, and GitHub credentials made available to the workflow;
- retry and recovery policy; and
- artifact upload, cross-job persistence, branch publication, and pull-request creation.

Command-only workflows do not require an agent harness. The Action itself requests no
GitHub token, Scherzo credential, harness-provider credential, or application credential.

## Before you start

The job must provide an existing `GITHUB_WORKSPACE`, a writable `RUNNER_TEMP`, the
workflow source, and an existing execution directory. Supported runners are:

- Linux x86-64;
- Linux ARM64; and
- macOS ARM64.

Windows and macOS x86-64 are not supported by V1.

## Run one workflow

This command-only example pins the first public mirror revision whose source and all
three native runner jobs passed. The caller owns checkout; the Action owns only the one
local workflow invocation and leaves its paths available to later steps in the same job.

```yaml
permissions:
  contents: read

steps:
  - name: Check out caller repository
    uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
    with:
      persist-credentials: false
  - name: Run checked-in Scherzo workflow
    id: scherzo
    uses: scherzo-systems/run-action@deb84786f26c01835c9d3590d3304125ed9d0273
    with:
      workflow: .scherzo/workflows/ci.yaml
  - name: Consume the retained result in the same job
    if: ${{ always() && steps.scherzo.outputs.result-path != '' }}
    env:
      ARTIFACT_SET_PATH: ${{ steps.scherzo.outputs.artifact-set-path }}
      RESULT_PATH: ${{ steps.scherzo.outputs.result-path }}
      WORKFLOW_OUTCOME: ${{ steps.scherzo.outputs.outcome }}
    run: |
      set -euo pipefail
      test -d "$ARTIFACT_SET_PATH"
      test -f "$RESULT_PATH"
      scherzo-cloud artifact validate --json "$ARTIFACT_SET_PATH" >/dev/null
      printf 'workflow outcome: %s\n' "$WORKFLOW_OUTCOME"
```

For a useful agent example, start with
[resolve a PR's merge conflicts](examples/resolve-pr-conflicts/README.md): comment
`/resolve-conflicts`, let an agent resolve the merge and run your checks, then publish
from an isolated job. The example supplies the helper code; customize the checks and
repair instructions. The Action embeds CLI v0.32.0, including the conditional-skip
fix. Before enabling the example, update its SHA after this Action refresh is
published and verified, as described in the example's setup notes.

The advanced [nightly Sentry repair composition](examples/nightly-sentry-repair/README.md)
adds agent-produced JSON discovery, a bounded GitHub matrix, and publisher
failure-isolation verification. Agent examples require harness setup and provider
credentials.

V1 provides no moving `v1`, `latest`, or semantic-version tag. Do not replace the SHA in
these examples with `main`, another branch or tag, an abbreviated value, or a Scherzo
Cloud monorepo commit.

## Inputs

| Input | Default | Purpose |
| --- | --- | --- |
| `workflow` | required | Workflow file to run. Relative paths resolve from `GITHUB_WORKSPACE`. |
| `source-root` | `GITHUB_WORKSPACE` | Complete source boundary containing the workflow and its static files. |
| `execution-root` | `GITHUB_WORKSPACE` | Existing caller-owned directory in which commands and agents run. |
| `prompt` | absent | Inline UTF-8 value supplied as `imports.prompt`. |
| `prompt-file` | absent | File whose exact bytes are supplied as `imports.prompt`. Conflicts with `prompt`. |
| `attachments` | absent | Ordered `media-type=path` pairs, one per line. |
| `max-parallel` | `1` | Maximum number of workflow nodes to run concurrently, from 1 through 256. |
| `export` | absent | Exact declared workflow export to bridge to selected-export outputs. |

Attachment input uses this line-oriented form:

```text
application/json=issue.json
image/png=screenshot.png
```

Relative workflow, source, execution, prompt-file, and attachment paths all resolve from
`GITHUB_WORKSPACE`. The Action does not infer a repository or workflow-directory
boundary.

## Outputs

| Output | Purpose |
| --- | --- |
| `outcome` | Committed workflow outcome: `succeeded`, `failed`, or `cancelled`. |
| `run-directory` | Durable local run directory when a trustworthy run identity is available. |
| `artifact-set-path` | Complete validated Portable Artifact Set path. |
| `result-path` | Committed `result.json` path inside the Artifact Set. |
| `export-state` | `available` or `unavailable` when `export` selected an exact declared export. |
| `export-kind` | Selected export kind: `file`, `text`, `json`, or `git_branch`. |
| `export-path` | Local carrier path for an available selected export, when present. |
| `export-value` | Inline bytes for eligible text or JSON exports up to 65,536 bytes. |

Paths are available only to later steps on the same runner. They are not URLs and do not
survive the job unless a later step uploads or publishes them. The presence of a path
does not mean the workflow succeeded; use the Action step conclusion or `outcome`.

The complete Artifact Set is the authoritative handoff. Selecting `export` only projects
one declared export into convenient GitHub step outputs; it does not filter or modify the
Artifact Set.

## Security and trust boundary

Local workflow execution is not a sandbox. Commands and agent harnesses run as the job
user and can use the files, environment, processes, credentials, and network access that
the job makes available. Do not expose a credential to the Action step unless the whole
workflow may exercise that authority.

Before launching the workflow, the Action removes its `INPUT_` variables and GitHub's
file-command handles from the child environment. It also prevents workflow log lines
from being interpreted as GitHub workflow commands. Other caller-provided environment
values remain available under the local Workflow V1 environment policy.

## Public distribution

The Action is distributed from
[`scherzo-systems/run-action`](https://github.com/scherzo-systems/run-action).
Pin `uses:` to a full 40-character commit SHA from that repository. Branches and moving
references do not provide the immutable selection required by V1.

Each Action revision carries its exact CLI release contract in
[`release-evidence.json`](release-evidence.json). Runtime bootstrap consumes that closed
record directly, verifies the downloaded release, and never performs a `latest` lookup
or falls back to an ambient CLI.

## Recovery

If a selected immutable Action revision is defective, choose a previously tested full
mirror SHA for future jobs. A published revision remains public: do not delete it,
force-move a reference, replace the SHA with a moving branch or tag, or claim that
selecting an older SHA erases the defective bytes. Publish any correction as a reviewed,
fully tested fast-forward revision.

## Development

Use Node 24.16 and npm 11.13. Install the committed lockfile and run the complete package
check:

```sh
npm ci
npm run check
```

Regenerate the committed GitHub runtime and third-party license inventory with:

```sh
npm run build
```

`npm run check` formats, type-checks, lints, and tests the authoritative TypeScript, then
rebuilds the bundle and license inventory in clean temporary directories and requires
byte equality with `dist/index.cjs` and `dist/licenses.txt`.
