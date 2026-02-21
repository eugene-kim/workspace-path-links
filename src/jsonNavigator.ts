import { Node, parseTree } from 'jsonc-parser';
import { JSONPath } from 'jsonpath-plus';

export interface JsonNavigationTarget {
  pointer: string;
  zeroBasedLine: number;
  preview: string;
}

export type JsonSelectorResolution =
  | { kind: 'single'; target: JsonNavigationTarget }
  | { kind: 'multiple'; targets: JsonNavigationTarget[] }
  | { kind: 'none'; message: string }
  | { kind: 'error'; message: string };

interface JsonPathResult {
  pointer?: string;
  value?: unknown;
}

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

function decodePointerSegment(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

function findObjectPropertyNode(node: Node, key: string): Node | undefined {
  if (node.type !== 'object' || !node.children) {
    return undefined;
  }

  return node.children.find((propertyNode) => {
    const keyNode = propertyNode.children?.[0];
    return keyNode?.value === key;
  });
}

export function findNodeByPointer(root: Node, pointer: string): Node | undefined {
  if (pointer === '') {
    return root;
  }

  if (!pointer.startsWith('/')) {
    return undefined;
  }

  const segments = pointer.split('/').slice(1).map(decodePointerSegment);
  if (segments.length === 0) {
    return root;
  }

  let current: Node | undefined = root;

  for (let index = 0; index < segments.length; index += 1) {
    if (!current) {
      return undefined;
    }

    const segment = segments[index];
    const isLast = index === segments.length - 1;

    if (current.type === 'object') {
      const propertyNode = findObjectPropertyNode(current, segment);
      if (!propertyNode) {
        return undefined;
      }

      if (isLast) {
        return propertyNode;
      }

      current = propertyNode.children?.[1];
      continue;
    }

    if (current.type === 'array') {
      if (!/^\d+$/.test(segment)) {
        return undefined;
      }

      const childNode = current.children?.[Number(segment)];
      if (!childNode) {
        return undefined;
      }

      if (isLast) {
        return childNode;
      }

      current = childNode;
      continue;
    }

    return undefined;
  }

  return current;
}

function parseJsonDocument(text: string): { data: unknown; root: Node } | { error: string } {
  try {
    const data = JSON.parse(text) as unknown;
    const root = parseTree(text);
    if (!root) {
      return { error: 'Workspace Path Links: Could not parse JSON AST.' };
    }

    return { data, root };
  } catch {
    return { error: 'Workspace Path Links: Target file is not valid JSON.' };
  }
}

function offsetToZeroBasedLine(text: string, offset: number): number {
  let line = 0;
  for (let i = 0; i < offset; i += 1) {
    if (text[i] === '\n') {
      line += 1;
    }
  }

  return line;
}

function extractFilterProperty(expression: string): string | undefined {
  const dotMatch = expression.match(/@\.([A-Za-z0-9_$-]+)/);
  if (dotMatch?.[1]) {
    return dotMatch[1];
  }

  const bracketMatch = expression.match(/@\[['"]([^'"\]]+)['"]\]/);
  return bracketMatch?.[1];
}

function shorten(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}

function makePreview(pointer: string, value: unknown): string {
  if (value === null || typeof value === 'number' || typeof value === 'boolean') {
    return `${pointer} = ${String(value)}`;
  }

  if (typeof value === 'string') {
    return `${pointer} = "${shorten(value, 80)}"`;
  }

  try {
    return `${pointer} = ${shorten(JSON.stringify(value), 80)}`;
  } catch {
    return pointer;
  }
}

function toTarget(text: string, node: Node, pointer: string, value: unknown): JsonNavigationTarget {
  return {
    pointer,
    zeroBasedLine: offsetToZeroBasedLine(text, node.offset),
    preview: makePreview(pointer, value)
  };
}

function preferMatchedPropertyNode(node: Node, propertyName: string | undefined): Node {
  if (!propertyName) {
    return node;
  }

  if (node.type === 'property') {
    return node;
  }

  if (node.type !== 'object') {
    return node;
  }

  return findObjectPropertyNode(node, propertyName) ?? node;
}

export function resolveJsonPointerTarget(text: string, pointer: string): JsonSelectorResolution {
  const parsed = parseJsonDocument(text);
  if ('error' in parsed) {
    return { kind: 'error', message: parsed.error };
  }

  const node = findNodeByPointer(parsed.root, pointer);
  if (!node) {
    return { kind: 'none', message: `Workspace Path Links: JSON Pointer not found: ${pointer}` };
  }

  return {
    kind: 'single',
    target: toTarget(text, node, pointer, node.value)
  };
}

export function resolveJsonPathTargets(text: string, expression: string): JsonSelectorResolution {
  const parsed = parseJsonDocument(text);
  if ('error' in parsed) {
    return { kind: 'error', message: parsed.error };
  }

  let results: JsonPathResult[];
  try {
    const jsonData = parsed.data as JsonValue;
    results = JSONPath({
      json: jsonData,
      path: expression,
      wrap: true,
      resultType: 'all',
      autostart: true
    }) as unknown as JsonPathResult[];
  } catch {
    return { kind: 'error', message: 'Workspace Path Links: Invalid JSONPath expression.' };
  }

  if (!results.length) {
    return { kind: 'none', message: 'Workspace Path Links: JSONPath did not match any object.' };
  }

  const preferredProperty = extractFilterProperty(expression);
  const deduped = new Map<string, JsonNavigationTarget>();

  for (const result of results) {
    if (!result.pointer || deduped.has(result.pointer)) {
      continue;
    }

    const node = findNodeByPointer(parsed.root, result.pointer);
    if (!node) {
      continue;
    }

    const revealNode = preferMatchedPropertyNode(node, preferredProperty);
    deduped.set(result.pointer, toTarget(text, revealNode, result.pointer, result.value));
  }

  const targets = [...deduped.values()];
  if (!targets.length) {
    return { kind: 'none', message: 'Workspace Path Links: JSONPath matched values without navigable locations.' };
  }

  if (targets.length === 1) {
    return { kind: 'single', target: targets[0] };
  }

  return {
    kind: 'multiple',
    targets
  };
}
