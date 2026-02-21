import { describe, expect, it } from 'vitest';
import { resolveJsonPathTargets, resolveJsonPointerTarget } from '../../jsonNavigator';

const SAMPLE_JSON = [
  '{',
  '  "table": [',
  '    {',
  '      "row": {',
  '        "borrower": "Magenta Buyer, LLC (McAfee)",',
  '        "tc": 10.84',
  '      }',
  '    },',
  '    {',
  '      "row": {',
  '        "borrower": "Blue Buyer, LLC",',
  '        "tc": 9.42',
  '      }',
  '    }',
  '  ]',
  '}'
].join('\n');

describe('resolveJsonPointerTarget', () => {
  it('resolves a valid pointer to a single line target', () => {
    const result = resolveJsonPointerTarget(SAMPLE_JSON, '/table/0/row/borrower');

    expect(result.kind).toBe('single');
    if (result.kind !== 'single') {
      return;
    }

    expect(result.target.pointer).toBe('/table/0/row/borrower');
    expect(result.target.zeroBasedLine).toBe(4);
  });

  it('returns none when pointer is not found', () => {
    const result = resolveJsonPointerTarget(SAMPLE_JSON, '/table/10/row/borrower');

    expect(result.kind).toBe('none');
  });
});

describe('resolveJsonPathTargets', () => {
  it('resolves a single JSONPath match', () => {
    const result = resolveJsonPathTargets(SAMPLE_JSON, '$.table[?(@.row.borrower=="Blue Buyer, LLC")].row.borrower');

    expect(result.kind).toBe('single');
    if (result.kind !== 'single') {
      return;
    }

    expect(result.target.pointer).toBe('/table/1/row/borrower');
    expect(result.target.zeroBasedLine).toBe(10);
  });

  it('returns multiple matches for broad JSONPath', () => {
    const result = resolveJsonPathTargets(SAMPLE_JSON, '$.table[*].row.borrower');

    expect(result.kind).toBe('multiple');
    if (result.kind !== 'multiple') {
      return;
    }

    expect(result.targets).toHaveLength(2);
    expect(result.targets.map((target) => target.pointer)).toEqual(['/table/0/row/borrower', '/table/1/row/borrower']);
  });

  it('returns error for malformed JSONPath', () => {
    const result = resolveJsonPathTargets(SAMPLE_JSON, '$.table[?(');

    expect(result.kind).toBe('error');
  });

  it('returns none for non-matching JSONPath', () => {
    const result = resolveJsonPathTargets(SAMPLE_JSON, '$.table[*].row[?(@.borrower=="nope")]');

    expect(result.kind).toBe('none');
  });
});
