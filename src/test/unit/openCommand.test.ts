import { describe, expect, it, vi } from 'vitest';
import { runOpenCommand, toZeroBasedLine } from '../../openCommand';

describe('toZeroBasedLine', () => {
  it('maps a valid 1-based line to 0-based', () => {
    expect(toZeroBasedLine(10)).toBe(9);
  });

  it('returns undefined for invalid line values', () => {
    expect(toZeroBasedLine(0)).toBeUndefined();
    expect(toZeroBasedLine(-1)).toBeUndefined();
    expect(toZeroBasedLine(undefined)).toBeUndefined();
  });
});

function makeDeps(overrides: Partial<Parameters<typeof runOpenCommand>[1]> = {}): Parameters<typeof runOpenCommand>[1] {
  return {
    fileExists: vi.fn().mockResolvedValue(true),
    fileSize: vi.fn().mockResolvedValue(128),
    readFile: vi.fn().mockResolvedValue('{}'),
    openFile: vi.fn().mockResolvedValue(undefined),
    pickJsonTarget: vi.fn().mockResolvedValue(undefined),
    showError: vi.fn(),
    jsonSelectorEnabled: true,
    maxQuickPickItems: 50,
    maxFileSizeBytes: 1024 * 1024,
    ...overrides
  };
}

describe('runOpenCommand', () => {
  it('opens file with zero-based line when line selector is provided', async () => {
    const deps = makeDeps();

    await runOpenCommand({ target: '/tmp/a.ts', selector: { kind: 'line', line: 10 } }, deps);

    expect(deps.fileExists).toHaveBeenCalledWith('/tmp/a.ts');
    expect(deps.openFile).toHaveBeenCalledWith('/tmp/a.ts', 9);
    expect(deps.showError).not.toHaveBeenCalled();
  });

  it('shows a concise error for missing files and does not throw', async () => {
    const deps = makeDeps({ fileExists: vi.fn().mockResolvedValue(false) });

    await expect(runOpenCommand({ target: '/tmp/missing.ts' }, deps)).resolves.toBeUndefined();

    expect(deps.openFile).not.toHaveBeenCalled();
    expect(deps.showError).toHaveBeenCalledWith('Workspace Path Links: File not found: /tmp/missing.ts');
  });

  it('resolves JSON pointer and opens matched property line', async () => {
    const deps = makeDeps({
      readFile: vi.fn().mockResolvedValue('{\n  "items": [\n    { "name": "x" }\n  ]\n}')
    });

    await runOpenCommand(
      {
        target: '/tmp/a.json',
        selector: { kind: 'jsonPointer', pointer: '/items/0/name' }
      },
      deps
    );

    expect(deps.openFile).toHaveBeenCalledWith('/tmp/a.json', 2);
    expect(deps.showError).not.toHaveBeenCalled();
  });

  it('uses quick pick for multiple JSONPath matches', async () => {
    const pickJsonTarget = vi.fn().mockResolvedValue({
      pointer: '/rows/1/name',
      zeroBasedLine: 3,
      preview: '/rows/1/name = "second"'
    });

    const deps = makeDeps({
      readFile: vi.fn().mockResolvedValue('{"rows":[{"name":"first"},{"name":"second"}]}'),
      pickJsonTarget
    });

    await runOpenCommand(
      {
        target: '/tmp/a.json',
        selector: { kind: 'jsonPath', expression: '$.rows[*].name' }
      },
      deps
    );

    expect(pickJsonTarget).toHaveBeenCalledTimes(1);
    expect(deps.openFile).toHaveBeenCalledWith('/tmp/a.json', 3);
  });
});
