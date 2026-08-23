# Nightly Sentry repair composition

This example composes the Run Action with caller-owned GitHub Actions setup. Copy the
`.github/` and `.scherzo/` files into the corresponding roots of the repository to repair.
The workflow intentionally calls a repository-owned `scripts/publish-scherzo-branch`
program that is not supplied by this Action.

Before enabling the schedule, configure:

- `OPENAI_API_KEY` for the model selected by the checked-in Pi profiles;
- read-only `SENTRY_AUTH_TOKEN` for discovery;
- `SENTRY_ORG_SLUG` and `SENTRY_PROJECT_SLUG` as repository variables; and
- `REPAIR_PUBLISHER_GITHUB_TOKEN` as a separate, repository-scoped publisher credential.

The caller checks out source, configures the local Git author identity used for repair
commits, installs exact Pi `0.83.0`, chooses the model, limits discovery to ten issues,
and bounds matrix concurrency at two. Replace the example author name and email with the
identity selected by caller policy. Discovery is an agent step whose declared
`agent_result` is the compact JSON matrix. Each matrix job invokes one repair workflow and
asks the Action to retain the `changes` export as `git_branch`.

Action output paths remain local to the repair runner. The caller copies the complete,
already-validated Artifact Set into a private GitHub Actions artifact with one-day
retention, then restores it in a separate publisher job. This explicit upload is
caller-owned cross-job persistence; the Action neither uploads the set nor claims that
its local paths survive a job.

## Publisher boundary

Provide `scripts/publish-scherzo-branch ARTIFACT_SET EXPORT_NAME` in the caller repository.
It must validate the complete Artifact Set, resolve the named `git_branch`, verify its
baseline against the separately authorized destination, and create at most one branch or
pull request. It must treat the Artifact Set and repaired tree as untrusted data: while
holding publisher authority, it must not execute a program or load executable
configuration from either. It must not modify the Artifact Set or `result.json`, and it
must not print the pull-request body, provider payload, or credential. Destination choice,
duplicate policy, branch naming, and idempotency remain caller policy.

The publisher job starts on a fresh runner and checks out the exact caller revision in
`github.sha` under `publisher-source`. It executes the publisher and all repository-owned
dependencies only from that immutable baseline, never from the workspace modified by the
repair agent. Only this fresh job receives `REPAIR_PUBLISHER_GITHUB_TOKEN`; neither Run
Action invocation nor the repair job receives publication authority.

The caller records byte identities before transfer, verifies them after transfer, and
compares them again after publication. A manual run with
`induce-publisher-failure: true` gives only deliberately invalid authority to the
publisher. For that run, the caller publisher must write this exact content-free JSON to
`SCHERZO_PUBLISHER_ATTESTATION_PATH` only after it issues the provider request and observes
the expected authorization rejection:

```json
{
  "schemaVersion": 1,
  "provider": "github",
  "operation": "publish_git_branch",
  "requestAttempted": true,
  "outcome": "authorization_denied"
}
```

A local preflight, missing tool, malformed Artifact Set, or other pre-request failure must
leave the attestation absent. The workflow accepts the induced failure only when the
publisher step fails, that exact attestation is present, and the already-committed Scherzo
workflow result and complete Artifact Set remain byte-identical.

Workflow V1 presentation is not a redacted channel: agent text, reasoning, and tool
results can reach the GitHub job log. Run this live composition only in a private dogfood
repository whose log access and retention satisfy the caller's Sentry and model-data
policy. Do not copy those logs into release evidence or treat prompt instructions as a
privacy boundary.

For release evidence, retain only immutable Action and source identities, safe harness and
provider identities, and access-controlled provider or GitHub run links. Do not retain the
issue matrix, prompt, model output, Artifact Set contents, publisher body, or credentials
in the release record.

## Recovery

If a published Action revision is defective, select a previously tested full immutable
mirror SHA for future jobs. Do not delete public bytes, force-move a reference, substitute
a branch or tag, or treat an old SHA as though it had never been published. Review and
test any corrective Action as a new fast-forward revision.
