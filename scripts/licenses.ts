import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

interface LockPackage {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly name?: string;
  readonly version?: string;
}

interface PackageLock {
  readonly packages: Readonly<Record<string, LockPackage>>;
}

function dependencyKey(
  packages: PackageLock["packages"],
  parent: string,
  name: string,
): string {
  let ancestor = parent;
  while (true) {
    const candidate = ancestor
      ? `${ancestor}/node_modules/${name}`
      : `node_modules/${name}`;
    if (packages[candidate]) return candidate;
    const marker = ancestor.lastIndexOf("/node_modules/");
    if (marker < 0) break;
    ancestor = ancestor.slice(0, marker);
  }
  const root = `node_modules/${name}`;
  if (packages[root]) return root;
  throw new Error(
    `production dependency ${name} is absent from package-lock.json`,
  );
}

function productionPackageKeys(lock: PackageLock): readonly string[] {
  const selected = new Set<string>();
  const visit = (
    parent: string,
    dependencies: Readonly<Record<string, string>>,
  ): void => {
    for (const name of Object.keys(dependencies).sort()) {
      const key = dependencyKey(lock.packages, parent, name);
      if (selected.has(key)) continue;
      selected.add(key);
      visit(key, lock.packages[key]?.dependencies ?? {});
    }
  };
  visit("", lock.packages[""]?.dependencies ?? {});
  return [...selected].sort();
}

export async function generateLicenses(output: string): Promise<void> {
  const lock = JSON.parse(
    await readFile(path.join(packageRoot, "package-lock.json"), "utf8"),
  ) as PackageLock;
  const records: { identity: string; license: string; text: string }[] = [];
  for (const key of productionPackageKeys(lock)) {
    const directory = path.join(packageRoot, key);
    const manifest = JSON.parse(
      await readFile(path.join(directory, "package.json"), "utf8"),
    ) as { name?: unknown; version?: unknown; license?: unknown };
    if (
      typeof manifest.name !== "string" ||
      typeof manifest.version !== "string" ||
      typeof manifest.license !== "string"
    ) {
      throw new Error(`dependency metadata is incomplete for ${key}`);
    }
    const licenseFiles = (await readdir(directory))
      .filter((name) => /^licen[cs]e(?:[._-].*)?$/iu.test(name))
      .sort();
    if (licenseFiles.length === 0) {
      throw new Error(`dependency license text is absent for ${key}`);
    }
    const texts = await Promise.all(
      licenseFiles.map(async (name) =>
        (await readFile(path.join(directory, name), "utf8")).trimEnd(),
      ),
    );
    records.push({
      identity: `${manifest.name}@${manifest.version}`,
      license: manifest.license,
      text: texts.join("\n\n"),
    });
  }
  records.sort((left, right) =>
    left.identity < right.identity
      ? -1
      : left.identity > right.identity
        ? 1
        : 0,
  );
  const contents = [
    "Scherzo Run Action third-party licenses",
    "Generated from the package-lock.json production dependency graph.",
    "",
    ...records.flatMap((record) => [
      `===== ${record.identity} (${record.license}) =====`,
      record.text,
      "",
    ]),
  ].join("\n");
  await mkdir(path.dirname(path.resolve(output)), { recursive: true });
  await writeFile(path.resolve(output), contents, "utf8");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await generateLicenses(process.argv[2] ?? "dist/licenses.txt");
}
