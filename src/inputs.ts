import { stat } from "node:fs/promises";
import path from "node:path";

import { AdapterError } from "./errors.ts";

interface InlineSource {
  readonly kind: "inline";
  readonly value: string;
}

interface PathSource {
  readonly kind: "path";
  readonly path: string;
}

export interface TextInput {
  readonly name: string;
  readonly kind: "text";
  readonly source: InlineSource | PathSource;
}

export interface JsonInput {
  readonly name: string;
  readonly kind: "json";
  readonly source: InlineSource | PathSource;
}

export interface FileInput {
  readonly name: string;
  readonly kind: "file";
  readonly mediaType: string;
  readonly path: string;
}

export interface AttachmentInput {
  readonly mediaType: string;
  readonly path: string;
}

export interface AttachmentsInput {
  readonly name: string;
  readonly kind: "attachments";
  readonly items: readonly AttachmentInput[];
}

export type NamedInput = TextInput | JsonInput | FileInput | AttachmentsInput;

export interface ActionInputs {
  readonly workspace: string;
  readonly workflow: string;
  readonly sourceRoot: string;
  readonly executionRoot: string;
  readonly namedInputs: readonly NamedInput[];
  readonly maximumParallel: string;
  readonly selectedExport?: string;
}

type JsonNode =
  JsonStringNode | JsonObjectNode | JsonArrayNode | JsonPrimitiveNode;

interface JsonStringNode {
  readonly type: "string";
  readonly start: number;
  readonly end: number;
  readonly value: string;
}

interface JsonObjectNode {
  readonly type: "object";
  readonly start: number;
  readonly end: number;
  readonly members: ReadonlyMap<string, JsonNode>;
}

interface JsonArrayNode {
  readonly type: "array";
  readonly start: number;
  readonly end: number;
  readonly items: readonly JsonNode[];
}

interface JsonPrimitiveNode {
  readonly type: "number" | "boolean" | "null";
  readonly start: number;
  readonly end: number;
}

class AcquisitionDocumentParser {
  readonly #source: string;
  #position = 0;

  constructor(source: string) {
    this.#source = source;
  }

  parse(): JsonNode {
    this.#skipWhitespace();
    const value = this.#parseValue();
    this.#skipWhitespace();
    if (this.#position !== this.#source.length) this.#invalid();
    return value;
  }

  #invalid(): never {
    throw new AdapterError("input_invalid");
  }

  #skipWhitespace(): void {
    while (
      this.#position < this.#source.length &&
      [" ", "\t", "\r", "\n"].includes(this.#source[this.#position]!)
    ) {
      this.#position += 1;
    }
  }

  #parseValue(): JsonNode {
    const character = this.#source[this.#position];
    if (character === '"') return this.#parseString();
    if (character === "{") return this.#parseObject();
    if (character === "[") return this.#parseArray();
    if (character === "t") return this.#parseLiteral("true", "boolean");
    if (character === "f") return this.#parseLiteral("false", "boolean");
    if (character === "n") return this.#parseLiteral("null", "null");
    if (
      character === "-" ||
      (character !== undefined && /[0-9]/u.test(character))
    ) {
      return this.#parseNumber();
    }
    return this.#invalid();
  }

  #parseLiteral(
    literal: "true" | "false" | "null",
    type: "boolean" | "null",
  ): JsonPrimitiveNode {
    const start = this.#position;
    if (!this.#source.startsWith(literal, start)) this.#invalid();
    this.#position += literal.length;
    return { type, start, end: this.#position };
  }

  #parseNumber(): JsonPrimitiveNode {
    const start = this.#position;
    if (this.#source[this.#position] === "-") this.#position += 1;
    if (this.#source[this.#position] === "0") {
      this.#position += 1;
      if (/[0-9]/u.test(this.#source[this.#position] ?? "")) this.#invalid();
    } else {
      if (!/[1-9]/u.test(this.#source[this.#position] ?? "")) this.#invalid();
      while (/[0-9]/u.test(this.#source[this.#position] ?? "")) {
        this.#position += 1;
      }
    }
    if (this.#source[this.#position] === ".") {
      this.#position += 1;
      if (!/[0-9]/u.test(this.#source[this.#position] ?? "")) this.#invalid();
      while (/[0-9]/u.test(this.#source[this.#position] ?? "")) {
        this.#position += 1;
      }
    }
    if (["e", "E"].includes(this.#source[this.#position] ?? "")) {
      this.#position += 1;
      if (["+", "-"].includes(this.#source[this.#position] ?? "")) {
        this.#position += 1;
      }
      if (!/[0-9]/u.test(this.#source[this.#position] ?? "")) this.#invalid();
      while (/[0-9]/u.test(this.#source[this.#position] ?? "")) {
        this.#position += 1;
      }
    }
    return { type: "number", start, end: this.#position };
  }

  #parseHexEscape(): number {
    const digits = this.#source.slice(this.#position, this.#position + 4);
    if (!/^[0-9A-Fa-f]{4}$/u.test(digits)) this.#invalid();
    this.#position += 4;
    return Number.parseInt(digits, 16);
  }

  #parseString(): JsonStringNode {
    const start = this.#position;
    this.#position += 1;
    let value = "";
    while (this.#position < this.#source.length) {
      const code = this.#source.charCodeAt(this.#position);
      if (code === 0x22) {
        this.#position += 1;
        return { type: "string", start, end: this.#position, value };
      }
      if (code === 0x5c) {
        this.#position += 1;
        const escape = this.#source[this.#position];
        this.#position += 1;
        const simple = new Map([
          ['"', '"'],
          ["\\", "\\"],
          ["/", "/"],
          ["b", "\b"],
          ["f", "\f"],
          ["n", "\n"],
          ["r", "\r"],
          ["t", "\t"],
        ]);
        const decoded = simple.get(escape ?? "");
        if (decoded !== undefined) {
          value += decoded;
          continue;
        }
        if (escape !== "u") this.#invalid();
        const first = this.#parseHexEscape();
        if (first >= 0xd800 && first <= 0xdbff) {
          if (
            this.#source.slice(this.#position, this.#position + 2) !== "\\u"
          ) {
            this.#invalid();
          }
          this.#position += 2;
          const second = this.#parseHexEscape();
          if (second < 0xdc00 || second > 0xdfff) this.#invalid();
          value += String.fromCodePoint(
            0x1_0000 + ((first - 0xd800) << 10) + (second - 0xdc00),
          );
        } else {
          if (first >= 0xdc00 && first <= 0xdfff) this.#invalid();
          value += String.fromCharCode(first);
        }
        continue;
      }
      if (code < 0x20 || (code >= 0xdc00 && code <= 0xdfff)) this.#invalid();
      if (code >= 0xd800 && code <= 0xdbff) {
        const second = this.#source.charCodeAt(this.#position + 1);
        if (second < 0xdc00 || second > 0xdfff) this.#invalid();
        value += this.#source.slice(this.#position, this.#position + 2);
        this.#position += 2;
      } else {
        value += this.#source[this.#position]!;
        this.#position += 1;
      }
    }
    return this.#invalid();
  }

  #parseObject(): JsonObjectNode {
    const start = this.#position;
    this.#position += 1;
    this.#skipWhitespace();
    const members = new Map<string, JsonNode>();
    if (this.#source[this.#position] === "}") {
      this.#position += 1;
      return { type: "object", start, end: this.#position, members };
    }
    while (true) {
      if (this.#source[this.#position] !== '"') this.#invalid();
      const name = this.#parseString().value;
      if (members.has(name)) this.#invalid();
      this.#skipWhitespace();
      if (this.#source[this.#position] !== ":") this.#invalid();
      this.#position += 1;
      this.#skipWhitespace();
      members.set(name, this.#parseValue());
      this.#skipWhitespace();
      const delimiter = this.#source[this.#position];
      this.#position += 1;
      if (delimiter === "}") {
        return { type: "object", start, end: this.#position, members };
      }
      if (delimiter !== ",") this.#invalid();
      this.#skipWhitespace();
    }
  }

  #parseArray(): JsonArrayNode {
    const start = this.#position;
    this.#position += 1;
    this.#skipWhitespace();
    const items: JsonNode[] = [];
    if (this.#source[this.#position] === "]") {
      this.#position += 1;
      return { type: "array", start, end: this.#position, items };
    }
    while (true) {
      items.push(this.#parseValue());
      this.#skipWhitespace();
      const delimiter = this.#source[this.#position];
      this.#position += 1;
      if (delimiter === "]") {
        return { type: "array", start, end: this.#position, items };
      }
      if (delimiter !== ",") this.#invalid();
      this.#skipWhitespace();
    }
  }
}

function invalid(): never {
  throw new AdapterError("input_invalid");
}

function optionalInput(
  environment: NodeJS.ProcessEnv,
  name: string,
): string | undefined {
  const value = environment[name];
  return value === undefined || value === "" ? undefined : value;
}

function resolveWorkspacePath(workspace: string, value: string): string {
  try {
    return path.resolve(workspace, value);
  } catch {
    return invalid();
  }
}

function exactMembers(
  object: JsonObjectNode,
  names: readonly string[],
): boolean {
  return (
    object.members.size === names.length &&
    names.every((name) => object.members.has(name))
  );
}

function requiredString(
  object: JsonObjectNode,
  name: string,
  allowEmpty: boolean,
): string {
  const node = object.members.get(name);
  if (node?.type !== "string" || (!allowEmpty && node.value === "")) invalid();
  return node.value;
}

function parseEntry(
  name: string,
  node: JsonNode,
  document: string,
  workspace: string,
): NamedInput {
  if (node.type !== "object") invalid();
  const kind = requiredString(node, "kind", false);
  if (kind === "text") {
    if (exactMembers(node, ["kind", "value"])) {
      return {
        name,
        kind,
        source: { kind: "inline", value: requiredString(node, "value", true) },
      };
    }
    if (exactMembers(node, ["kind", "path"])) {
      return {
        name,
        kind,
        source: {
          kind: "path",
          path: resolveWorkspacePath(
            workspace,
            requiredString(node, "path", false),
          ),
        },
      };
    }
    return invalid();
  }
  if (kind === "json") {
    if (exactMembers(node, ["kind", "value"])) {
      const value = node.members.get("value");
      if (value === undefined) invalid();
      return {
        name,
        kind,
        source: {
          kind: "inline",
          value: document.slice(value.start, value.end),
        },
      };
    }
    if (exactMembers(node, ["kind", "path"])) {
      return {
        name,
        kind,
        source: {
          kind: "path",
          path: resolveWorkspacePath(
            workspace,
            requiredString(node, "path", false),
          ),
        },
      };
    }
    return invalid();
  }
  if (kind === "file") {
    if (!exactMembers(node, ["kind", "mediaType", "path"])) invalid();
    return {
      name,
      kind,
      mediaType: requiredString(node, "mediaType", false),
      path: resolveWorkspacePath(
        workspace,
        requiredString(node, "path", false),
      ),
    };
  }
  if (kind === "attachments") {
    if (!exactMembers(node, ["kind", "items"])) invalid();
    const items = node.members.get("items");
    if (items?.type !== "array") invalid();
    return {
      name,
      kind,
      items: items.items.map((item) => {
        if (
          item.type !== "object" ||
          !exactMembers(item, ["mediaType", "path"])
        ) {
          return invalid();
        }
        return {
          mediaType: requiredString(item, "mediaType", false),
          path: resolveWorkspacePath(
            workspace,
            requiredString(item, "path", false),
          ),
        };
      }),
    };
  }
  return invalid();
}

function compareUtf8(left: NamedInput, right: NamedInput): number {
  return Buffer.compare(
    Buffer.from(left.name, "utf8"),
    Buffer.from(right.name, "utf8"),
  );
}

export function parseNamedInputs(
  document: string | undefined,
  workspace: string,
): readonly NamedInput[] {
  if (document === undefined || document === "") return [];
  try {
    const root = new AcquisitionDocumentParser(document).parse();
    if (root.type !== "object") invalid();
    const inputs = [...root.members].map(([name, node]) => {
      if (!/^[a-z][A-Za-z0-9]{0,63}$/u.test(name)) invalid();
      return parseEntry(name, node, document, workspace);
    });
    return inputs.sort(compareUtf8);
  } catch (error) {
    if (error instanceof AdapterError) throw error;
    return invalid();
  }
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

  for (const removed of [
    "INPUT_PROMPT",
    "INPUT_PROMPT-FILE",
    "INPUT_ATTACHMENTS",
  ]) {
    if (Object.prototype.hasOwnProperty.call(environment, removed)) invalid();
  }

  const workflowValue = optionalInput(environment, "INPUT_WORKFLOW");
  if (!workflowValue) throw new AdapterError("input_invalid");

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
    namedInputs: parseNamedInputs(environment.INPUT_INPUTS, workspace),
    maximumParallel,
    ...(selectedExport === undefined ? {} : { selectedExport }),
  };
}
