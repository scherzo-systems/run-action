import assert from "node:assert/strict";
import {
  cp,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  bootstrapCli,
  DEFAULT_BOOTSTRAP_DEPENDENCIES,
} from "../src/bootstrap.ts";
import { DEFAULT_ACTION_DEPENDENCIES, executeAction } from "../src/main.ts";

const releaseBundle = process.env.SCHERZO_RUN_ACTION_RELEASE_BUNDLE;

test(
  "the staged pinned release executes one all-kind named-input Action invocation",
  { skip: releaseBundle === undefined },
  async () => {
    assert.ok(releaseBundle);
    const root = await mkdtemp(
      path.join(os.tmpdir(), "scherzo-release-action-"),
    );
    try {
      const workspace = path.join(root, "workspace");
      const runnerTemp = path.join(root, "runner-temp");
      await cp(path.join(releaseBundle, "all-kind-scenario"), workspace, {
        recursive: true,
      });
      await mkdir(runnerTemp);
      const outputFile = path.join(root, "github-output");
      const pathFile = path.join(root, "github-path");
      const environment: NodeJS.ProcessEnv = {
        ...process.env,
        GITHUB_WORKSPACE: workspace,
        RUNNER_TEMP: runnerTemp,
        RUNNER_OS: "Linux",
        RUNNER_ARCH: "ARM64",
        GITHUB_OUTPUT: outputFile,
        GITHUB_PATH: pathFile,
        INPUT_WORKFLOW: "workflow.yaml",
        INPUT_INPUTS: JSON.stringify({
          inlineText: { kind: "text", value: "release-check" },
          emptyText: { kind: "text", value: "" },
          inlineJson: { kind: "json", value: null },
          fileJson: { kind: "json", path: "value.json" },
          emptyFile: {
            kind: "file",
            mediaType: "application/octet-stream",
            path: "empty.bin",
          },
          evidence: {
            kind: "attachments",
            items: [{ mediaType: "text/plain", path: "attachment.txt" }],
          },
          emptyEvidence: { kind: "attachments", items: [] },
        }),
      };
      const result = await executeAction(environment, {
        ...DEFAULT_ACTION_DEPENDENCIES,
        bootstrap: (sourceEnvironment) =>
          bootstrapCli(sourceEnvironment, {
            ...DEFAULT_BOOTSTRAP_DEPENDENCIES,
            fetch: async (url) => {
              const name = path.posix.basename(new URL(url).pathname);
              const bytes = await readFile(
                path.join(releaseBundle, "assets", name),
              );
              return new Response(new Uint8Array(bytes), {
                status: 200,
                headers: { "content-length": String(bytes.length) },
              });
            },
          }),
      });

      assert.equal(result.failure, undefined);
      assert.equal(result.outputs.outcome, "succeeded");
      assert.equal(
        await stat(result.outputs["result-path"]).then((value) =>
          value.isFile(),
        ),
        true,
      );
      const allocations = (
        await readdir(runnerTemp, { withFileTypes: true })
      ).filter(
        (entry) =>
          entry.isDirectory() && entry.name.startsWith(".scherzo-run-"),
      );
      const actionAllocation = allocations.find(
        (entry) => !entry.name.startsWith(".scherzo-run-cli-"),
      );
      assert.ok(actionAllocation);
      const actionEntries = await readdir(
        path.join(runnerTemp, actionAllocation.name),
      );
      assert.deepEqual(actionEntries, ["run"]);
      const outputBytes = await readFile(outputFile, "utf8");
      assert.equal(outputBytes.includes("release-check"), false);
      assert.equal(outputBytes.includes('{"ok":true}'), false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
