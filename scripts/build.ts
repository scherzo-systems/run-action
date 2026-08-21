import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build as esbuild } from "esbuild";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

export async function buildBundle(outputDirectory: string): Promise<string> {
  const absoluteOutput = path.resolve(outputDirectory);
  await mkdir(absoluteOutput, { recursive: true });
  const output = path.join(absoluteOutput, "index.cjs");
  await esbuild({
    absWorkingDir: packageRoot,
    bundle: true,
    charset: "utf8",
    entryPoints: ["src/index.ts"],
    format: "cjs",
    legalComments: "none",
    logLevel: "silent",
    minify: false,
    outfile: output,
    platform: "node",
    sourcemap: false,
    target: "node24",
  });
  return output;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await buildBundle(process.argv[2] ?? "dist");
}
