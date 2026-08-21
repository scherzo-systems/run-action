import { stat } from "node:fs/promises";
import path from "node:path";

import { AdapterError } from "./errors.ts";

export interface AttachmentInput {
  readonly mediaType: string;
  readonly path: string;
}

export interface ActionInputs {
  readonly workspace: string;
  readonly workflow: string;
  readonly sourceRoot: string;
  readonly executionRoot: string;
  readonly prompt?: string;
  readonly promptFile?: string;
  readonly attachments: readonly AttachmentInput[];
  readonly maximumParallel: string;
  readonly selectedExport?: string;
}

function optionalInput(
  environment: NodeJS.ProcessEnv,
  name: string,
): string | undefined {
  const value = environment[name];
  return value === undefined || value === "" ? undefined : value;
}

function resolveWorkspacePath(workspace: string, value: string): string {
  return path.resolve(workspace, value);
}

export function parseAttachments(
  value: string | undefined,
  workspace: string,
): readonly AttachmentInput[] {
  if (value === undefined || value === "") {
    return [];
  }

  let body = value;
  if (body.endsWith("\r\n")) {
    body = body.slice(0, -2);
  } else if (body.endsWith("\n")) {
    body = body.slice(0, -1);
  }

  const attachments: AttachmentInput[] = [];
  const lines = body.split("\n");
  for (const [index, originalLine] of lines.entries()) {
    let line = originalLine;
    if (line.endsWith("\r") && index < lines.length - 1) {
      line = line.slice(0, -1);
    }
    const delimiter = line.indexOf("=");
    if (
      line === "" ||
      line.includes("\r") ||
      delimiter <= 0 ||
      delimiter === line.length - 1
    ) {
      throw new AdapterError("input_invalid");
    }
    attachments.push({
      mediaType: line.slice(0, delimiter),
      path: resolveWorkspacePath(workspace, line.slice(delimiter + 1)),
    });
  }
  return attachments;
}

export async function readActionInputs(
  environment: NodeJS.ProcessEnv,
): Promise<ActionInputs> {
  const workspaceValue = environment.GITHUB_WORKSPACE;
  if (!workspaceValue || !path.isAbsolute(workspaceValue)) {
    throw new AdapterError("input_invalid");
  }
  const workspace = path.resolve(workspaceValue);
  const workspaceStatus = await stat(workspace).catch(() => undefined);
  if (!workspaceStatus?.isDirectory()) {
    throw new AdapterError("input_invalid");
  }

  const workflowValue = optionalInput(environment, "INPUT_WORKFLOW");
  const prompt = optionalInput(environment, "INPUT_PROMPT");
  const promptFileValue = optionalInput(environment, "INPUT_PROMPT-FILE");
  if (
    !workflowValue ||
    (prompt !== undefined && promptFileValue !== undefined)
  ) {
    throw new AdapterError("input_invalid");
  }

  const maximumParallel =
    optionalInput(environment, "INPUT_MAX-PARALLEL") ?? "1";
  if (!/^[0-9]+$/u.test(maximumParallel)) {
    throw new AdapterError("input_invalid");
  }
  const parallelValue = BigInt(maximumParallel);
  if (parallelValue < 1n || parallelValue > 256n) {
    throw new AdapterError("input_invalid");
  }

  const sourceRootValue = optionalInput(environment, "INPUT_SOURCE-ROOT");
  const executionRootValue = optionalInput(environment, "INPUT_EXECUTION-ROOT");
  const attachmentsValue = optionalInput(environment, "INPUT_ATTACHMENTS");
  const selectedExport = optionalInput(environment, "INPUT_EXPORT");

  return {
    workspace,
    workflow: resolveWorkspacePath(workspace, workflowValue),
    sourceRoot:
      sourceRootValue === undefined
        ? workspace
        : resolveWorkspacePath(workspace, sourceRootValue),
    executionRoot:
      executionRootValue === undefined
        ? workspace
        : resolveWorkspacePath(workspace, executionRootValue),
    ...(prompt === undefined ? {} : { prompt }),
    ...(promptFileValue === undefined
      ? {}
      : { promptFile: resolveWorkspacePath(workspace, promptFileValue) }),
    attachments: parseAttachments(attachmentsValue, workspace),
    maximumParallel,
    ...(selectedExport === undefined ? {} : { selectedExport }),
  };
}
