import { OpenCommandArgs } from './types';

export interface OpenCommandDependencies {
  fileExists: (absolutePath: string) => Promise<boolean>;
  openFile: (absolutePath: string, zeroBasedLine?: number) => Promise<void>;
  showError: (message: string) => void;
}

export function toZeroBasedLine(line: number | undefined): number | undefined {
  if (line === undefined) {
    return undefined;
  }

  if (!Number.isSafeInteger(line) || line < 1) {
    return undefined;
  }

  return line - 1;
}

export async function runOpenCommand(args: OpenCommandArgs | undefined, deps: OpenCommandDependencies): Promise<void> {
  if (!args?.target) {
    deps.showError('Workspace Path Links: Invalid link target.');
    return;
  }

  try {
    const exists = await deps.fileExists(args.target);
    if (!exists) {
      deps.showError(`Workspace Path Links: File not found: ${args.target}`);
      return;
    }

    await deps.openFile(args.target, toZeroBasedLine(args.line));
  } catch {
    deps.showError('Workspace Path Links: Could not open target file.');
  }
}
