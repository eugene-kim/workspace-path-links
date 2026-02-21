import { ParsedReference } from './types';

const TRAILING_PUNCTUATION = new Set(['.', ',', ')']);

function isTerminator(char: string): boolean {
  return /\s/.test(char) || char === '"' || char === "'" || char === '`' || char === '<' || char === '>';
}

function stripTrailingPunctuation(candidate: string): string {
  let end = candidate.length;
  while (end > 0 && TRAILING_PUNCTUATION.has(candidate[end - 1])) {
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

function parseReferenceToken(token: string, prefix: string): { path: string; line?: number } | undefined {
  const rest = token.slice(prefix.length);
  if (!rest) {
    return undefined;
  }

  const lastColon = rest.lastIndexOf(':');
  if (lastColon === -1) {
    return { path: rest };
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

  return { path: pathPart, line };
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

    let cursor = index + prefix.length;
    while (cursor < text.length && !isTerminator(text[cursor])) {
      cursor += 1;
    }

    const rawToken = text.slice(index, cursor);
    const strippedToken = stripTrailingPunctuation(rawToken);

    if (strippedToken.length > prefix.length) {
      const parsed = parseReferenceToken(strippedToken, prefix);
      if (parsed) {
        matches.push({
          raw: strippedToken,
          prefix,
          path: parsed.path,
          line: parsed.line,
          start: index,
          end: index + strippedToken.length
        });
      }
    }

    index = cursor;
  }

  return matches;
}
