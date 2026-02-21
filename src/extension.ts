import * as vscode from 'vscode';
import { getCommentRanges, isRangeInsideComment } from './commentDetector';
import { JsonNavigationTarget, resolveJsonPathTargets, resolveJsonPointerTarget } from './jsonNavigator';
import { runOpenCommand, toZeroBasedLine } from './openCommand';
import { parseWorkspacePathReferences } from './parser';
import { resolveWorkspacePath } from './resolver';
import { OpenCommandArgs, ReferenceSelector, WorkspacePathLinksConfig } from './types';

const COMMAND_ID = 'workspacePathLinks.open';
const SUPPORTED_LANGUAGES = ['javascript', 'javascriptreact', 'typescript', 'typescriptreact'];

function readConfig(): WorkspacePathLinksConfig {
  const config = vscode.workspace.getConfiguration('workspacePathLinks');
  const prefixes = config.get<string[]>('prefixes', ['@/']);
  const maxQuickPickItems = Math.max(1, config.get<number>('jsonSelector.maxQuickPickItems', 50));
  const maxFileSizeBytes = Math.max(1024, config.get<number>('jsonSelector.maxFileSizeBytes', 5 * 1024 * 1024));

  return {
    enabled: config.get<boolean>('enabled', true),
    prefixes,
    jsonSelectorEnabled: config.get<boolean>('jsonSelector.enabled', true),
    maxQuickPickItems,
    maxFileSizeBytes
  };
}

function toCommandUri(args: OpenCommandArgs): vscode.Uri {
  const encodedArgs = encodeURIComponent(JSON.stringify([args]));
  return vscode.Uri.parse(`command:${COMMAND_ID}?${encodedArgs}`);
}

interface ResolvedReference {
  range: vscode.Range;
  args: OpenCommandArgs;
  targetUri: vscode.Uri;
}

function toQuickPickItems(targets: JsonNavigationTarget[]): Array<vscode.QuickPickItem & { target: JsonNavigationTarget }> {
  return targets.map((target) => ({
    label: target.pointer,
    description: `line ${target.zeroBasedLine + 1}`,
    detail: target.preview,
    target
  }));
}

async function pickJsonTarget(targets: JsonNavigationTarget[], placeHolder: string): Promise<JsonNavigationTarget | undefined> {
  const selected = await vscode.window.showQuickPick(toQuickPickItems(targets), {
    placeHolder
  });

  return selected?.target;
}

function collectReferences(document: vscode.TextDocument, config: WorkspacePathLinksConfig): ResolvedReference[] {
  const text = document.getText();
  const commentRanges = getCommentRanges(text, document.languageId);
  const parsedReferences = parseWorkspacePathReferences(text, config.prefixes);
  const workspaceFolderPath = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath;

  return parsedReferences
    .filter((reference) => isRangeInsideComment(reference.start, reference.end, commentRanges))
    .filter((reference) => {
      if (reference.selector.kind === 'jsonPointer' || reference.selector.kind === 'jsonPath') {
        return config.jsonSelectorEnabled;
      }

      return true;
    })
    .map((reference) => {
      const absolutePath = resolveWorkspacePath({
        referencePath: reference.path,
        documentPath: document.uri.fsPath,
        workspaceFolderPath
      });

      return {
        range: new vscode.Range(document.positionAt(reference.start), document.positionAt(reference.end)),
        targetUri: vscode.Uri.file(absolutePath),
        args: {
          target: absolutePath,
          selector: reference.selector
        }
      };
    });
}

async function fileExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

async function resolveSelectorLine(
  targetUri: vscode.Uri,
  selector: ReferenceSelector | undefined,
  config: WorkspacePathLinksConfig
): Promise<number | undefined> {
  if (!selector || selector.kind === 'none') {
    return 0;
  }

  if (selector.kind === 'line') {
    const line = toZeroBasedLine(selector.line);
    return line ?? 0;
  }

  if (!config.jsonSelectorEnabled) {
    return undefined;
  }

  const stat = await vscode.workspace.fs.stat(targetUri);
  if (stat.size > config.maxFileSizeBytes) {
    void vscode.window.showErrorMessage(
      `Workspace Path Links: JSON file exceeds size limit (${config.maxFileSizeBytes} bytes).`
    );
    return undefined;
  }

  const text = new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(targetUri));
  const resolution =
    selector.kind === 'jsonPointer'
      ? resolveJsonPointerTarget(text, selector.pointer)
      : resolveJsonPathTargets(text, selector.expression);

  if (resolution.kind === 'error' || resolution.kind === 'none') {
    void vscode.window.showErrorMessage(resolution.message);
    return undefined;
  }

  if (resolution.kind === 'single') {
    return resolution.target.zeroBasedLine;
  }

  if (resolution.targets.length > config.maxQuickPickItems) {
    void vscode.window.showErrorMessage(
      `Workspace Path Links: JSONPath matched ${resolution.targets.length} objects; limit is ${config.maxQuickPickItems}.`
    );
    return undefined;
  }

  const selected = await pickJsonTarget(resolution.targets, 'Select JSON object to go to definition');
  return selected?.zeroBasedLine;
}

export function activate(context: vscode.ExtensionContext): void {
  let extensionConfig = readConfig();

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('workspacePathLinks')) {
        extensionConfig = readConfig();
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_ID, async (args?: OpenCommandArgs) => {
      await runOpenCommand(args, {
        fileExists: async (absolutePath) => fileExists(vscode.Uri.file(absolutePath)),
        fileSize: async (absolutePath) => {
          const stat = await vscode.workspace.fs.stat(vscode.Uri.file(absolutePath));
          return stat.size;
        },
        readFile: async (absolutePath) => {
          const content = await vscode.workspace.fs.readFile(vscode.Uri.file(absolutePath));
          return new TextDecoder('utf-8').decode(content);
        },
        openFile: async (absolutePath, zeroBasedLine) => {
          const uri = vscode.Uri.file(absolutePath);
          const editor = await vscode.window.showTextDocument(uri, { preview: false });

          if (zeroBasedLine !== undefined) {
            const position = new vscode.Position(zeroBasedLine, 0);
            const range = new vscode.Range(position, position);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
          }
        },
        showError: (message) => {
          void vscode.window.showErrorMessage(message);
        },
        pickJsonTarget: async (targets: JsonNavigationTarget[]) => pickJsonTarget(targets, 'Select JSON object to open'),
        jsonSelectorEnabled: extensionConfig.jsonSelectorEnabled,
        maxQuickPickItems: extensionConfig.maxQuickPickItems,
        maxFileSizeBytes: extensionConfig.maxFileSizeBytes
      });
    })
  );

  const selector: vscode.DocumentSelector = SUPPORTED_LANGUAGES.map((language) => ({
    language,
    scheme: 'file'
  }));

  const linkProvider: vscode.DocumentLinkProvider = {
    provideDocumentLinks(document: vscode.TextDocument): vscode.ProviderResult<vscode.DocumentLink[]> {
      if (!extensionConfig.enabled) {
        return [];
      }

      return collectReferences(document, extensionConfig).map(
        (reference) => new vscode.DocumentLink(reference.range, toCommandUri(reference.args))
      );
    }
  };

  const definitionProvider: vscode.DefinitionProvider = {
    async provideDefinition(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Location | undefined> {
      if (!extensionConfig.enabled) {
        return undefined;
      }

      const candidate = collectReferences(document, extensionConfig).find((reference) => reference.range.contains(position));
      if (!candidate) {
        return undefined;
      }

      if (!(await fileExists(candidate.targetUri))) {
        void vscode.window.showErrorMessage(`Workspace Path Links: File not found: ${candidate.targetUri.fsPath}`);
        return undefined;
      }

      const line = await resolveSelectorLine(candidate.targetUri, candidate.args.selector, extensionConfig);
      if (line === undefined) {
        return undefined;
      }

      return new vscode.Location(candidate.targetUri, new vscode.Position(line, 0));
    }
  };

  context.subscriptions.push(vscode.languages.registerDocumentLinkProvider(selector, linkProvider));
  context.subscriptions.push(vscode.languages.registerDefinitionProvider(selector, definitionProvider));
}

export function deactivate(): void {
  // No-op.
}
