import path from 'node:path';

export interface ResolveInput {
  referencePath: string;
  documentPath: string;
  workspaceFolderPath?: string;
}

export function resolveWorkspacePath(input: ResolveInput): string {
  const baseDir = input.workspaceFolderPath ?? path.dirname(input.documentPath);
  const relativePath = input.referencePath.replace(/^[/\\]+/, '');

  return path.resolve(baseDir, relativePath);
}
