import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveWorkspacePath } from '../../resolver';

describe('resolveWorkspacePath', () => {
  it('resolves from workspace folder in single-root', () => {
    const resolved = resolveWorkspacePath({
      referencePath: 'README.md',
      documentPath: path.join('/repo', 'src', 'main.ts'),
      workspaceFolderPath: '/repo'
    });

    expect(resolved).toBe(path.resolve('/repo', 'README.md'));
  });

  it('resolves from owning workspace folder in multi-root scenarios', () => {
    const resolved = resolveWorkspacePath({
      referencePath: 'docs/guide.md',
      documentPath: path.join('/repo', 'packages', 'ext-a', 'src', 'index.ts'),
      workspaceFolderPath: path.join('/repo', 'packages', 'ext-a')
    });

    expect(resolved).toBe(path.resolve('/repo/packages/ext-a', 'docs/guide.md'));
  });

  it('falls back to current document directory when no workspace exists', () => {
    const resolved = resolveWorkspacePath({
      referencePath: 'local.md',
      documentPath: path.join('/tmp', 'scratch', 'notes.ts')
    });

    expect(resolved).toBe(path.resolve('/tmp/scratch', 'local.md'));
  });
});
