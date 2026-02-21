import ts from 'typescript';
import { CommentRange } from './types';

function languageVariantFor(languageId: string): ts.LanguageVariant {
  return languageId.endsWith('react') ? ts.LanguageVariant.JSX : ts.LanguageVariant.Standard;
}

export function getCommentRanges(text: string, languageId: string): CommentRange[] {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, languageVariantFor(languageId), text);
  const ranges: CommentRange[] = [];

  let token = scanner.scan();
  while (token !== ts.SyntaxKind.EndOfFileToken) {
    if (token === ts.SyntaxKind.SingleLineCommentTrivia || token === ts.SyntaxKind.MultiLineCommentTrivia) {
      ranges.push({
        start: scanner.getTokenPos(),
        end: scanner.getTextPos()
      });
    }

    token = scanner.scan();
  }

  return ranges;
}

export function isRangeInsideComment(start: number, end: number, commentRanges: CommentRange[]): boolean {
  return commentRanges.some((comment) => start >= comment.start && end <= comment.end);
}
