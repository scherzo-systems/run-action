import { createReadStream } from "node:fs";
import streamJson from "stream-json";

import { AdapterError } from "./errors.ts";

export type TerminalOutcome =
  "succeeded" | "failed" | "cancelled" | "interrupted" | "rejected";

export interface TerminalEnvelope {
  readonly schemaVersion: number;
  readonly command: string;
  readonly outcome: TerminalOutcome;
  readonly exitStatus: number;
  readonly runDirectory?: string;
  readonly attemptNumber?: number;
  readonly resultDirectory?: string;
  readonly rootKeys: ReadonlySet<string>;
}

interface JsonToken {
  readonly name: string;
  readonly value?: unknown;
}

const { parser } = streamJson;

function primitiveValue(token: JsonToken): unknown {
  if (token.name !== "numberValue") return token.value;
  if (typeof token.value !== "string") {
    throw new AdapterError("terminal_result_invalid");
  }
  if (!/^-?(?:0|[1-9][0-9]*)$/u.test(token.value)) {
    throw new AdapterError("terminal_result_invalid");
  }
  const value = Number(token.value);
  if (!Number.isSafeInteger(value)) {
    throw new AdapterError("terminal_result_invalid");
  }
  return value;
}

const PRIMITIVE_TOKENS = new Set([
  "stringValue",
  "numberValue",
  "nullValue",
  "trueValue",
  "falseValue",
]);

export async function readTerminalEnvelope(
  file: string,
): Promise<TerminalEnvelope> {
  const stream = createReadStream(file).pipe(parser());
  const values = new Map<string, unknown>();
  const rootKeys = new Set<string>();
  let depth = 0;
  let pendingRootKey: string | undefined;
  let rootStarted = false;
  let rootEnded = false;

  try {
    for await (const raw of stream) {
      const token = raw as JsonToken;
      if (token.name === "startObject" || token.name === "startArray") {
        depth += 1;
        if (!rootStarted) {
          if (token.name !== "startObject" || depth !== 1) {
            throw new AdapterError("terminal_result_invalid");
          }
          rootStarted = true;
        }
        pendingRootKey = undefined;
        continue;
      }
      if (token.name === "endObject" || token.name === "endArray") {
        if (depth === 1 && token.name === "endObject") rootEnded = true;
        depth -= 1;
        if (depth < 0) throw new AdapterError("terminal_result_invalid");
        continue;
      }
      if (token.name === "keyValue" && depth === 1) {
        if (typeof token.value !== "string" || rootKeys.has(token.value)) {
          throw new AdapterError("terminal_result_invalid");
        }
        pendingRootKey = token.value;
        rootKeys.add(token.value);
        continue;
      }
      if (depth === 1 && pendingRootKey && PRIMITIVE_TOKENS.has(token.name)) {
        values.set(pendingRootKey, primitiveValue(token));
        pendingRootKey = undefined;
      }
    }
  } catch (error) {
    if (error instanceof AdapterError) throw error;
    throw new AdapterError("terminal_result_invalid");
  }

  if (!rootStarted || !rootEnded || depth !== 0) {
    throw new AdapterError("terminal_result_invalid");
  }
  const schemaVersion = values.get("schemaVersion");
  const command = values.get("command");
  const outcome = values.get("outcome");
  const exitStatus = values.get("exitStatus");
  if (
    schemaVersion !== 1 ||
    command !== "scherzo-cloud workflow run" ||
    !["succeeded", "failed", "cancelled", "interrupted", "rejected"].includes(
      String(outcome),
    ) ||
    typeof exitStatus !== "number" ||
    !Number.isSafeInteger(exitStatus)
  ) {
    throw new AdapterError("terminal_result_invalid");
  }

  const optionalString = (name: string): string | undefined => {
    const value = values.get(name);
    return typeof value === "string" ? value : undefined;
  };
  const optionalInteger = (name: string): number | undefined => {
    const value = values.get(name);
    return typeof value === "number" && Number.isSafeInteger(value)
      ? value
      : undefined;
  };
  const runDirectory = optionalString("runDirectory");
  const attemptNumber = optionalInteger("attemptNumber");
  const resultDirectory = optionalString("resultDirectory");
  return {
    schemaVersion,
    command,
    outcome: outcome as TerminalOutcome,
    exitStatus,
    ...(runDirectory === undefined ? {} : { runDirectory }),
    ...(attemptNumber === undefined ? {} : { attemptNumber }),
    ...(resultDirectory === undefined ? {} : { resultDirectory }),
    rootKeys,
  };
}

function sameKeys(
  actual: ReadonlySet<string>,
  expected: readonly string[],
): boolean {
  return (
    actual.size === expected.length && expected.every((key) => actual.has(key))
  );
}

export function validateTerminalShape(envelope: TerminalEnvelope): void {
  if (["succeeded", "failed", "cancelled"].includes(envelope.outcome)) {
    if (
      !sameKeys(envelope.rootKeys, [
        "schemaVersion",
        "command",
        "outcome",
        "exitStatus",
        "runDirectory",
        "attemptNumber",
        "resultDirectory",
        "result",
      ]) ||
      !envelope.runDirectory ||
      !envelope.resultDirectory ||
      envelope.attemptNumber === undefined ||
      envelope.attemptNumber < 1
    ) {
      throw new AdapterError("terminal_result_invalid");
    }
    return;
  }
  if (envelope.outcome === "interrupted") {
    if (
      !sameKeys(envelope.rootKeys, [
        "schemaVersion",
        "command",
        "outcome",
        "exitStatus",
        "runDirectory",
        "attemptNumber",
        "interruption",
      ]) ||
      !envelope.runDirectory ||
      envelope.attemptNumber === undefined ||
      envelope.attemptNumber < 1 ||
      envelope.exitStatus !== 1
    ) {
      throw new AdapterError("terminal_result_invalid");
    }
    return;
  }
  if (
    envelope.outcome === "rejected" &&
    (!sameKeys(envelope.rootKeys, [
      "schemaVersion",
      "command",
      "outcome",
      "exitStatus",
      "phase",
      "workflow",
      "diagnostics",
    ]) ||
      envelope.exitStatus !== 1)
  ) {
    throw new AdapterError("terminal_result_invalid");
  }
}
