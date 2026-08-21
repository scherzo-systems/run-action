import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { generateLicenses } from "./licenses.ts";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const temporary = await mkdtemp(
  path.join(os.tmpdir(), "scherzo-run-licenses-"),
);
try {
  const generated = path.join(temporary, "licenses.txt");
  await generateLicenses(generated);
  const [expectedBytes, actualBytes] = await Promise.all([
    readFile(path.join(packageRoot, "dist/licenses.txt")),
    readFile(generated),
  ]);
  if (!expectedBytes.equals(actualBytes)) {
    throw new Error("dist/licenses.txt is not reproducible; run npm run build");
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
