import path from "node:path";

const FILE_COMMAND_VARIABLES = new Set([
  "GITHUB_OUTPUT",
  "GITHUB_ENV",
  "GITHUB_PATH",
  "GITHUB_STATE",
  "GITHUB_STEP_SUMMARY",
]);

export function sanitizedChildEnvironment(
  source: NodeJS.ProcessEnv,
  cliDirectory: string,
): NodeJS.ProcessEnv {
  const child: NodeJS.ProcessEnv = {};
  for (const [name, value] of Object.entries(source)) {
    if (
      name.startsWith("INPUT_") ||
      name.startsWith("SCHERZO_RUN_ACTION_") ||
      FILE_COMMAND_VARIABLES.has(name)
    ) {
      continue;
    }
    child[name] = value;
  }

  const inheritedPath = source.PATH;
  child.PATH = inheritedPath
    ? `${cliDirectory}${path.delimiter}${inheritedPath}`
    : cliDirectory;
  return child;
}
