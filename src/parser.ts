import { ParsedReference } from './types';

const TRAILING_PUNCTUATION = new Set(['.', ',', ')']);

function isTerminator(char: string): boolean {
  return /\s/.test(char) || char === '"' || char === "'" || char === '`' || char === '<' || char === '>';
}

function findTokenEnd(text: string, start: number): number {
  let cursor = start;
  let inJsonPathMode = false;
  let quote: '"' | "'" | undefined;
  let bracketDepth = 0;
  let parenDepth = 0;

  while (cursor < text.length) {
    if (!inJsonPathMode && text.startsWith('#jsonpath=', cursor)) {
      inJsonPathMode = true;
      cursor += '#jsonpath='.length;
      continue;
    }

    const char = text[cursor];
    const previousChar = cursor > 0 ? text[cursor - 1] : '';

    if (!inJsonPathMode) {
      if (isTerminator(char)) {
        break;
      }
      cursor += 1;
      continue;
    }

    if (quote) {
      if (char === quote && previousChar !== '\\') {
        quote = undefined;
      }
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '[') {
      bracketDepth += 1;
    } else if (char === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
    } else if (char === '(') {
      parenDepth += 1;
    } else if (char === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
    } else if (isTerminator(char) && bracketDepth === 0 && parenDepth === 0) {
      break;
    }

    cursor += 1;
  }

  return cursor;
}

function stripTrailingPunctuation(candidate: string): string {
  const openParenCount = (candidate.match(/\(/g) ?? []).length;
  let closeParenCount = (candidate.match(/\)/g) ?? []).length;
  let end = candidate.length;

  while (end > 0) {
    const char = candidate[end - 1];
    if (!TRAILING_PUNCTUATION.has(char)) {
      break;
    }

    if (char === ')') {
      if (closeParenCount <= openParenCount) {
        break;
      }

      closeParenCount -= 1;
    }

    end -= 1;
  }

  return candidate.slice(0, end);
}

function normalizePrefixes(prefixes: string[]): string[] {
  const cleaned = prefixes
    .filter((prefix): prefix is string => typeof prefix === 'string')
    .map((prefix) => prefix.trim())
    .filter((prefix) => prefix.length > 0);

  return [...new Set(cleaned)].sort((a, b) => b.length - a.length);
}

function tryDecode(value: string): string | undefined {
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

function parseReferenceToken(token: string, prefix: string): Omit<ParsedReference, 'raw' | 'prefix' | 'start' | 'end'> | undefined {
  const rest = token.slice(prefix.length);
  if (!rest) {
    return undefined;
  }

  const hashIndex = rest.indexOf('#');
  if (hashIndex !== -1) {
    const pathPart = rest.slice(0, hashIndex);
    const fragment = rest.slice(hashIndex + 1);
    if (!pathPart || !fragment) {
      return undefined;
    }

    if (fragment.startsWith('/')) {
      const pointer = tryDecode(fragment);
      if (!pointer || !pointer.startsWith('/')) {
        return undefined;
      }

      return {
        path: pathPart,
        selector: {
          kind: 'jsonPointer',
          pointer
        }
      };
    }

    if (fragment.startsWith('jsonpath=')) {
      const expression = tryDecode(fragment.slice('jsonpath='.length));
      if (!expression || expression.trim().length === 0) {
        return undefined;
      }

      return {
        path: pathPart,
        selector: {
          kind: 'jsonPath',
          expression
        }
      };
    }

    return undefined;
  }

  const lastColon = rest.lastIndexOf(':');
  if (lastColon === -1) {
    return { path: rest, selector: { kind: 'none' } };
  }

  const pathPart = rest.slice(0, lastColon);
  const linePart = rest.slice(lastColon + 1);

  if (!pathPart || !/^\d+$/.test(linePart)) {
    return undefined;
  }

  const line = Number(linePart);
  if (!Number.isSafeInteger(line) || line < 1) {
    return undefined;
  }

  return {
    path: pathPart,
    selector: {
      kind: 'line',
      line
    }
  };
}

export function parseWorkspacePathReferences(text: string, prefixes: string[]): ParsedReference[] {
  const normalizedPrefixes = normalizePrefixes(prefixes);
  if (!normalizedPrefixes.length) {
    return [];
  }

  const matches: ParsedReference[] = [];
  let index = 0;

  while (index < text.length) {
    const prefix = normalizedPrefixes.find((candidate) => text.startsWith(candidate, index));
    if (!prefix) {
      index += 1;
      continue;
    }

    const cursor = findTokenEnd(text, index + prefix.length);

    const rawToken = text.slice(index, cursor);
    const strippedToken = stripTrailingPunctuation(rawToken);

    if (strippedToken.length > prefix.length) {
      const parsed = parseReferenceToken(strippedToken, prefix);
      if (parsed) {
        matches.push({
          raw: strippedToken,
          prefix,
          path: parsed.path,
          selector: parsed.selector,
          start: index,
          end: index + strippedToken.length
        });
      }
    }

    index = cursor;
  }

  return matches;
}
