import { JsonNavigationTarget, resolveJsonPathTargets, resolveJsonPointerTarget } from './jsonNavigator';
import { OpenCommandArgs } from './types';

export interface OpenCommandDependencies {
  fileExists: (absolutePath: string) => Promise<boolean>;
  fileSize: (absolutePath: string) => Promise<number>;
  readFile: (absolutePath: string) => Promise<string>;
  openFile: (absolutePath: string, zeroBasedLine?: number) => Promise<void>;
  pickJsonTarget: (targets: JsonNavigationTarget[]) => Promise<JsonNavigationTarget | undefined>;
  showError: (message: string) => void;
  jsonSelectorEnabled: boolean;
  maxQuickPickItems: number;
  maxFileSizeBytes: number;
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

    const selector = args.selector;
    if (!selector || selector.kind === 'none') {
      await deps.openFile(args.target);
      return;
    }

    if (selector.kind === 'line') {
      await deps.openFile(args.target, toZeroBasedLine(selector.line));
      return;
    }

    if (!deps.jsonSelectorEnabled) {
      deps.showError('Workspace Path Links: JSON selector navigation is disabled.');
      return;
    }

    const size = await deps.fileSize(args.target);
    if (size > deps.maxFileSizeBytes) {
      deps.showError(`Workspace Path Links: JSON file exceeds size limit (${deps.maxFileSizeBytes} bytes).`);
      return;
    }

    const fileContent = await deps.readFile(args.target);
    const resolution =
      selector.kind === 'jsonPointer'
        ? resolveJsonPointerTarget(fileContent, selector.pointer)
        : resolveJsonPathTargets(fileContent, selector.expression);

    if (resolution.kind === 'error' || resolution.kind === 'none') {
      deps.showError(resolution.message);
      return;
    }

    if (resolution.kind === 'single') {
      await deps.openFile(args.target, resolution.target.zeroBasedLine);
      return;
    }

    if (resolution.targets.length > deps.maxQuickPickItems) {
      deps.showError(
        `Workspace Path Links: JSONPath matched ${resolution.targets.length} objects; limit is ${deps.maxQuickPickItems}.`
      );
      return;
    }

    const selected = await deps.pickJsonTarget(resolution.targets);
    if (!selected) {
      return;
    }

    await deps.openFile(args.target, selected.zeroBasedLine);
  } catch {
    deps.showError('Workspace Path Links: Could not open target file.');
  }
}
