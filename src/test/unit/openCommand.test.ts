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

describe('runOpenCommand', () => {
  it('opens file with zero-based line when provided', async () => {
    const fileExists = vi.fn().mockResolvedValue(true);
    const openFile = vi.fn().mockResolvedValue(undefined);
    const showError = vi.fn();

    await runOpenCommand({ target: '/tmp/a.ts', line: 10 }, { fileExists, openFile, showError });

    expect(fileExists).toHaveBeenCalledWith('/tmp/a.ts');
    expect(openFile).toHaveBeenCalledWith('/tmp/a.ts', 9);
    expect(showError).not.toHaveBeenCalled();
  });

  it('shows a concise error for missing files and does not throw', async () => {
    const fileExists = vi.fn().mockResolvedValue(false);
    const openFile = vi.fn();
    const showError = vi.fn();

    await expect(runOpenCommand({ target: '/tmp/missing.ts' }, { fileExists, openFile, showError })).resolves.toBeUndefined();

    expect(openFile).not.toHaveBeenCalled();
    expect(showError).toHaveBeenCalledWith('Workspace Path Links: File not found: /tmp/missing.ts');
  });
});
