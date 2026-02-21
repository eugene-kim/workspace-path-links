import * as vscode from 'vscode';
import { getCommentRanges, isRangeInsideComment } from './commentDetector';
import { JsonNavigationTarget } from './jsonNavigator';
import { runOpenCommand } from './openCommand';
import { parseWorkspacePathReferences } from './parser';
import { resolveWorkspacePath } from './resolver';
import { OpenCommandArgs, WorkspacePathLinksConfig } from './types';

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
        fileExists: async (absolutePath) => {
          try {
            await vscode.workspace.fs.stat(vscode.Uri.file(absolutePath));
            return true;
          } catch {
            return false;
          }
        },
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
        pickJsonTarget: async (targets: JsonNavigationTarget[]) => {
          const quickPickItems = targets.map((target) => ({
            label: target.pointer,
            description: `line ${target.zeroBasedLine + 1}`,
            detail: target.preview
          }));

          const selected = await vscode.window.showQuickPick(quickPickItems, {
            placeHolder: 'Select JSON object to open'
          });

          if (!selected) {
            return undefined;
          }

          return targets.find((target) => target.pointer === selected.label && `line ${target.zeroBasedLine + 1}` === selected.description);
        },
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

  const provider: vscode.DocumentLinkProvider = {
    provideDocumentLinks(document: vscode.TextDocument): vscode.ProviderResult<vscode.DocumentLink[]> {
      if (!extensionConfig.enabled) {
        return [];
      }

      const text = document.getText();
      const commentRanges = getCommentRanges(text, document.languageId);
      const parsedReferences = parseWorkspacePathReferences(text, extensionConfig.prefixes);
      const workspaceFolderPath = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath;

      return parsedReferences
        .filter((reference) => isRangeInsideComment(reference.start, reference.end, commentRanges))
        .filter((reference) => {
          if (reference.selector.kind === 'jsonPointer' || reference.selector.kind === 'jsonPath') {
            return extensionConfig.jsonSelectorEnabled;
          }

          return true;
        })
        .map((reference) => {
          const absolutePath = resolveWorkspacePath({
            referencePath: reference.path,
            documentPath: document.uri.fsPath,
            workspaceFolderPath
          });

          const range = new vscode.Range(document.positionAt(reference.start), document.positionAt(reference.end));
          return new vscode.DocumentLink(
            range,
            toCommandUri({
              target: absolutePath,
              selector: reference.selector
            })
          );
        });
    }
  };

  context.subscriptions.push(vscode.languages.registerDocumentLinkProvider(selector, provider));
}

export function deactivate(): void {
  // No-op.
}
