import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildBundle } from "./build.ts";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const temporary = await mkdtemp(path.join(os.tmpdir(), "scherzo-run-bundle-"));
try {
  const generated = await buildBundle(temporary);
  const [expectedBytes, actualBytes] = await Promise.all([
    readFile(path.join(packageRoot, "dist/index.cjs")),
    readFile(generated),
  ]);
  if (!expectedBytes.equals(actualBytes)) {
    throw new Error("dist/index.cjs is not reproducible; run npm run build");
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
