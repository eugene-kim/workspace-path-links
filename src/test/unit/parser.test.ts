import { describe, expect, it } from 'vitest';
import { parseWorkspacePathReferences } from '../../parser';

describe('parseWorkspacePathReferences', () => {
  it('parses valid path-only references', () => {
    const refs = parseWorkspacePathReferences('// link: @/src/index.ts', ['@/']);

    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({
      prefix: '@/',
      path: 'src/index.ts',
      line: undefined,
      raw: '@/src/index.ts'
    });
  });

  it('parses valid path+line references', () => {
    const refs = parseWorkspacePathReferences('// link: @/src/index.ts:57', ['@/']);

    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({
      path: 'src/index.ts',
      line: 57,
      raw: '@/src/index.ts:57'
    });
  });

  it('rejects invalid line suffixes', () => {
    const text = ['// @/file.ts:abc', '// @/file.ts:0', '// @/file.ts:-1'].join('\n');
    const refs = parseWorkspacePathReferences(text, ['@/']);

    expect(refs).toHaveLength(0);
  });

  it('strips trailing punctuation', () => {
    const refs = parseWorkspacePathReferences('// @/src/file.ts:12).', ['@/']);

    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({
      path: 'src/file.ts',
      line: 12,
      raw: '@/src/file.ts:12'
    });
  });

  it('supports multiple configured prefixes', () => {
    const refs = parseWorkspacePathReferences('// @/a.ts and $/b.ts:2', ['$/', '@/']);

    expect(refs).toHaveLength(2);
    expect(refs[0]?.prefix).toBe('@/');
    expect(refs[1]?.prefix).toBe('$/');
  });
});
