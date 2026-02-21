import { describe, expect, it } from 'vitest';
import { getCommentRanges, isRangeInsideComment } from '../../commentDetector';
import { parseWorkspacePathReferences } from '../../parser';

const languageId = 'typescript';

describe('comment detection', () => {
  it('detects single-line and multi-line comments', () => {
    const text = [
      "const s = '@/not-comment.ts';",
      '// @/single.ts',
      '/*',
      '  @/multi.ts:3',
      '*/'
    ].join('\n');

    const refs = parseWorkspacePathReferences(text, ['@/']);
    const commentRanges = getCommentRanges(text, languageId);
    const commentRefs = refs.filter((ref) => isRangeInsideComment(ref.start, ref.end, commentRanges));

    expect(refs).toHaveLength(3);
    expect(commentRefs).toHaveLength(2);
    expect(commentRefs.map((ref) => ref.path)).toEqual(['single.ts', 'multi.ts']);
  });

  it('handles multi-line block comment spans', () => {
    const text = ['/*', ' * docs: @/docs/readme.md:9', ' */', 'const x = 1;'].join('\n');

    const refs = parseWorkspacePathReferences(text, ['@/']);
    const commentRanges = getCommentRanges(text, languageId);

    expect(refs).toHaveLength(1);
    expect(isRangeInsideComment(refs[0].start, refs[0].end, commentRanges)).toBe(true);
  });

  it('ignores link-like text in strings after filtering to comment ranges', () => {
    const text = [
      'const a = "@/inside-string.ts";',
      '// @/inside-comment.ts'
    ].join('\n');

    const refs = parseWorkspacePathReferences(text, ['@/']);
    const commentRanges = getCommentRanges(text, languageId);
    const commentRefs = refs.filter((ref) => isRangeInsideComment(ref.start, ref.end, commentRanges));

    expect(commentRefs).toHaveLength(1);
    expect(commentRefs[0].path).toBe('inside-comment.ts');
  });
});
