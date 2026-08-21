import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, realpath, rm, symlink } from "node:fs/promises";
import { once } from "node:events";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { gzipSync } from "node:zlib";
import tarStream from "tar-stream";

import { bootstrapCli, type BootstrapDependencies } from "../src/bootstrap.ts";
import { AdapterError } from "../src/errors.ts";
import {
  PINNED_RELEASE,
  type ReleaseEvidence,
  type TargetTriple,
} from "../src/release.ts";
import type { CapturedCommand } from "../src/subprocess.ts";

const targets: readonly {
  runnerOS: string;
  runnerArch: string;
  target: TargetTriple;
}[] = [
  { runnerOS: "Linux", runnerArch: "X64", target: "x86_64-unknown-linux-gnu" },
  {
    runnerOS: "Linux",
    runnerArch: "ARM64",
    target: "aarch64-unknown-linux-gnu",
  },
  { runnerOS: "macOS", runnerArch: "ARM64", target: "aarch64-apple-darwin" },
];

type TarMutation = "traversal" | "link" | "inventory" | "mode";

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function archiveBytes(
  root: string,
  mutation?: TarMutation,
): Promise<{
  bytes: Buffer;
  inventory: {
    path: string;
    type: "directory" | "file";
    mode: number;
    size: number;
  }[];
}> {
  const pack = tarStream.pack();
  const chunks: Buffer[] = [];
  pack.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  const ended = once(pack, "end");
  const license = Buffer.from("license\n");
  const readme = Buffer.from("readme\n");
  const executable = Buffer.from("fake executable\n");
  pack.entry({ name: `${root}/`, type: "directory", mode: 0o755, size: 0 });
  pack.entry({ name: `${root}/LICENSE`, type: "file", mode: 0o644 }, license);
  if (mutation === "link") {
    pack.entry({
      name: `${root}/README.md`,
      type: "symlink",
      linkname: "/outside",
      mode: 0o644,
      size: 0,
    });
  } else {
    pack.entry(
      {
        name:
          mutation === "traversal"
            ? `${root}/../README.md`
            : `${root}/README.md`,
        type: "file",
        mode: 0o644,
      },
      readme,
    );
  }
  pack.entry(
    {
      name: `${root}/scherzo-cloud`,
      type: "file",
      mode: mutation === "mode" ? 0o700 : 0o755,
    },
    executable,
  );
  if (mutation === "inventory") {
    pack.entry(
      { name: `${root}/extra`, type: "file", mode: 0o644 },
      Buffer.from("x"),
    );
  }
  pack.finalize();
  await ended;
  return {
    bytes: gzipSync(Buffer.concat(chunks)),
    inventory: [
      { path: root, type: "directory", mode: 0o755, size: 0 },
      {
        path: `${root}/LICENSE`,
        type: "file",
        mode: 0o644,
        size: license.length,
      },
      {
        path: `${root}/README.md`,
        type: "file",
        mode: 0o644,
        size: readme.length,
      },
      {
        path: `${root}/scherzo-cloud`,
        type: "file",
        mode: 0o755,
        size: executable.length,
      },
    ],
  };
}

interface BootstrapFixture {
  readonly release: ReleaseEvidence;
  readonly responses: ReadonlyMap<string, Buffer>;
}

async function fixture(
  selectedTarget?: TargetTriple,
  mutation?: TarMutation,
): Promise<BootstrapFixture> {
  const release = structuredClone(PINNED_RELEASE) as ReleaseEvidence;
  const mutable = release as unknown as {
    checksumAsset: { url: string; size: number; sha256: string };
    archives: Record<
      TargetTriple,
      {
        name: string;
        url: string;
        size: number;
        sha256: string;
        rootDirectory: string;
        inventory: {
          path: string;
          type: "directory" | "file";
          mode: number;
          size: number;
        }[];
      }
    >;
  };
  const responses = new Map<string, Buffer>();
  const checksumLines: string[] = [];
  for (const { target } of targets) {
    const archive = mutable.archives[target];
    archive.url = `https://fixture.invalid/${archive.name}`;
    const built = await archiveBytes(
      archive.rootDirectory,
      target === selectedTarget ? mutation : undefined,
    );
    archive.size = built.bytes.length;
    archive.sha256 = sha256(built.bytes);
    archive.inventory = built.inventory;
    responses.set(archive.url, built.bytes);
    checksumLines.push(`${archive.sha256}  ${archive.name}`);
  }
  const checksums = Buffer.from(`${checksumLines.join("\n")}\n`);
  mutable.checksumAsset.url = "https://fixture.invalid/SHA256SUMS";
  mutable.checksumAsset.size = checksums.length;
  mutable.checksumAsset.sha256 = sha256(checksums);
  responses.set(mutable.checksumAsset.url, checksums);
  return { release, responses };
}

function dependencies(
  fixtureValue: BootstrapFixture,
  observations: {
    fetched: string[];
    executables: string[];
    appended: string[];
  },
  versionChange?: (version: Record<string, unknown>) => void,
): BootstrapDependencies {
  return {
    fetch: async (url) => {
      observations.fetched.push(url);
      const bytes = fixtureValue.responses.get(url);
      if (!bytes) return new Response(null, { status: 404 });
      return new Response(new Uint8Array(bytes), {
        status: 200,
        headers: { "content-length": String(bytes.length) },
      });
    },
    runVersion: async (executable, environment): Promise<CapturedCommand> => {
      observations.executables.push(executable);
      assert.equal(environment.INPUT_WORKFLOW, undefined);
      assert.equal(environment.GITHUB_OUTPUT, undefined);
      assert.match(
        environment.PATH ?? "",
        new RegExp(`^${path.dirname(executable)}`),
      );
      const version: Record<string, unknown> = {
        schemaVersion: 1,
        command: "scherzo-cloud",
        version: fixtureValue.release.version,
        executablePath: await realpath(executable),
        buildIdentity: fixtureValue.release.buildIdentity,
      };
      versionChange?.(version);
      return {
        code: 0,
        signal: null,
        stdout: Buffer.from(`${JSON.stringify(version)}\n`),
        stdoutOverflow: false,
        stderrOverflow: false,
      };
    },
    appendPath: async (_file, directory) => {
      observations.appended.push(directory);
    },
  };
}

async function withRunnerTemp(
  callback: (runnerTemp: string) => Promise<void>,
): Promise<void> {
  const runnerTemp = await mkdtemp(
    path.join(os.tmpdir(), "scherzo-bootstrap-"),
  );
  try {
    await callback(runnerTemp);
  } finally {
    await rm(runnerTemp, { recursive: true, force: true });
  }
}

test("all supported platforms verify and install only their closed archive", async (t) => {
  for (const platform of targets) {
    await t.test(platform.target, async () => {
      await withRunnerTemp(async (runnerTemp) => {
        const fixtureValue = await fixture();
        const observed = {
          fetched: [] as string[],
          executables: [] as string[],
          appended: [] as string[],
        };
        const result = await bootstrapCli(
          {
            RUNNER_OS: platform.runnerOS,
            RUNNER_ARCH: platform.runnerArch,
            RUNNER_TEMP: runnerTemp,
            GITHUB_PATH: path.join(runnerTemp, "github-path"),
            PATH: "/ambient/decoy:/caller/bin",
            INPUT_WORKFLOW: "private input",
            GITHUB_OUTPUT: "/private/command",
          },
          dependencies(fixtureValue, observed),
          fixtureValue.release,
        );
        const selected = fixtureValue.release.archives[platform.target];
        assert.deepEqual(observed.fetched, [
          fixtureValue.release.checksumAsset.url,
          selected.url,
        ]);
        assert.deepEqual(observed.executables, [result.executable]);
        assert.deepEqual(observed.appended, [result.cliDirectory]);
        assert.equal(
          result.executable,
          path.join(result.cliDirectory, "scherzo-cloud"),
        );
        assert.equal(
          result.environment.PATH,
          `${result.cliDirectory}${path.delimiter}/ambient/decoy:/caller/bin`,
        );
      });
    });
  }
});

test("a supported runner temp may use a symlinked absolute path", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "scherzo-bootstrap-link-"),
  );
  try {
    const physicalTemp = path.join(directory, "physical");
    const runnerTemp = path.join(directory, "runner-temp");
    await mkdir(physicalTemp);
    await symlink(physicalTemp, runnerTemp, "dir");
    const fixtureValue = await fixture();
    const observed = {
      fetched: [] as string[],
      executables: [] as string[],
      appended: [] as string[],
    };

    const result = await bootstrapCli(
      {
        RUNNER_OS: "Linux",
        RUNNER_ARCH: "X64",
        RUNNER_TEMP: runnerTemp,
      },
      dependencies(fixtureValue, observed),
      fixtureValue.release,
    );

    assert.equal(result.executable, await realpath(result.executable));
    assert.deepEqual(observed.executables, [result.executable]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("bootstrap failures stay closed before ambient fallback", async (t) => {
  await withRunnerTemp(async (runnerTemp) => {
    const platform = targets[0]!;
    const cases: readonly {
      name: string;
      prepare: (fixtureValue: BootstrapFixture) => Promise<{
        fixtureValue: BootstrapFixture;
        deps: BootstrapDependencies;
      }>;
    }[] = [
      {
        name: "retrieval",
        prepare: async (fixtureValue) => ({
          fixtureValue,
          deps: {
            ...dependencies(fixtureValue, {
              fetched: [],
              executables: [],
              appended: [],
            }),
            fetch: async () => {
              throw new Error("offline");
            },
          },
        }),
      },
      ...(["traversal", "link", "inventory", "mode"] as const).map(
        (mutation) => ({
          name: `tar-${mutation}`,
          prepare: async () => {
            const fixtureValue = await fixture(platform.target, mutation);
            return {
              fixtureValue,
              deps: dependencies(fixtureValue, {
                fetched: [],
                executables: [],
                appended: [],
              }),
            };
          },
        }),
      ),
      ...(
        [
          "schemaVersion",
          "command",
          "version",
          "executablePath",
          "buildIdentity",
        ] as const
      ).map((field) => ({
        name: `version-${field}`,
        prepare: async (fixtureValue: BootstrapFixture) => ({
          fixtureValue,
          deps: dependencies(
            fixtureValue,
            { fetched: [], executables: [], appended: [] },
            (version) => {
              version[field] = field === "schemaVersion" ? 2 : "wrong";
            },
          ),
        }),
      })),
    ];

    for (const scenario of cases) {
      await t.test(scenario.name, async () => {
        const base = await fixture();
        const prepared = await scenario.prepare(base);
        await assert.rejects(
          bootstrapCli(
            {
              RUNNER_OS: platform.runnerOS,
              RUNNER_ARCH: platform.runnerArch,
              RUNNER_TEMP: runnerTemp,
              PATH: "/ambient/successful-decoy",
            },
            prepared.deps,
            prepared.fixtureValue.release,
          ),
          AdapterError,
        );
      });
    }
  });
});

test("checksum and archive byte corruption fail before version inspection", async () => {
  await withRunnerTemp(async (runnerTemp) => {
    const fixtureValue = await fixture();
    const platform = targets[0]!;
    for (const url of [
      fixtureValue.release.checksumAsset.url,
      fixtureValue.release.archives[platform.target].url,
    ]) {
      let versionRuns = 0;
      const corrupted = new Map(fixtureValue.responses);
      const bytes = Buffer.from(corrupted.get(url)!);
      bytes[0] = (bytes[0] ?? 0) ^ 0xff;
      corrupted.set(url, bytes);
      const changed = { ...fixtureValue, responses: corrupted };
      const deps = dependencies(changed, {
        fetched: [],
        executables: [],
        appended: [],
      });
      const wrapped: BootstrapDependencies = {
        ...deps,
        runVersion: async (...arguments_) => {
          versionRuns += 1;
          return deps.runVersion(...arguments_);
        },
      };
      await assert.rejects(
        bootstrapCli(
          {
            RUNNER_OS: platform.runnerOS,
            RUNNER_ARCH: platform.runnerArch,
            RUNNER_TEMP: runnerTemp,
          },
          wrapped,
          fixtureValue.release,
        ),
        AdapterError,
      );
      assert.equal(versionRuns, 0);
    }
  });
});

test("archive size and checksum layout drift fail before version inspection", async (t) => {
  await withRunnerTemp(async (runnerTemp) => {
    const platform = targets[0]!;
    await t.test("archive size", async () => {
      const fixtureValue = await fixture();
      const archiveUrl = fixtureValue.release.archives[platform.target].url;
      const responses = new Map(fixtureValue.responses);
      responses.set(
        archiveUrl,
        Buffer.concat([responses.get(archiveUrl)!, Buffer.from([0])]),
      );
      let versionRuns = 0;
      const changed = { ...fixtureValue, responses };
      const base = dependencies(changed, {
        fetched: [],
        executables: [],
        appended: [],
      });
      await assert.rejects(
        bootstrapCli(
          {
            RUNNER_OS: platform.runnerOS,
            RUNNER_ARCH: platform.runnerArch,
            RUNNER_TEMP: runnerTemp,
          },
          {
            ...base,
            runVersion: async (...arguments_) => {
              versionRuns += 1;
              return base.runVersion(...arguments_);
            },
          },
          fixtureValue.release,
        ),
        AdapterError,
      );
      assert.equal(versionRuns, 0);
    });

    await t.test("checksum layout", async () => {
      const fixtureValue = await fixture();
      const release = structuredClone(fixtureValue.release) as ReleaseEvidence;
      const checksumUrl = release.checksumAsset.url;
      const changedBytes = Buffer.from(
        fixtureValue.responses.get(checksumUrl)!,
      );
      changedBytes[0] = changedBytes[0] === 0x30 ? 0x31 : 0x30;
      const mutableChecksum = release.checksumAsset as {
        size: number;
        sha256: string;
      };
      mutableChecksum.size = changedBytes.length;
      mutableChecksum.sha256 = sha256(changedBytes);
      const responses = new Map(fixtureValue.responses);
      responses.set(checksumUrl, changedBytes);
      const changed = { release, responses };
      await assert.rejects(
        bootstrapCli(
          {
            RUNNER_OS: platform.runnerOS,
            RUNNER_ARCH: platform.runnerArch,
            RUNNER_TEMP: runnerTemp,
          },
          dependencies(changed, {
            fetched: [],
            executables: [],
            appended: [],
          }),
          release,
        ),
        AdapterError,
      );
    });
  });
});

test("unsupported platform fails without retrieval", async () => {
  let fetches = 0;
  await assert.rejects(
    bootstrapCli(
      { RUNNER_OS: "Windows", RUNNER_ARCH: "X64" },
      {
        fetch: async () => {
          fetches += 1;
          return new Response();
        },
        runVersion: () => {
          throw new Error("must not run");
        },
        appendPath: async () => undefined,
      },
    ),
    (error: unknown) =>
      error instanceof AdapterError &&
      error.code === "bootstrap_platform_unsupported",
  );
  assert.equal(fetches, 0);
});
