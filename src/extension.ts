import * as vscode from 'vscode';
import { getCommentRanges, isRangeInsideComment } from './commentDetector';
import { runOpenCommand } from './openCommand';
import { parseWorkspacePathReferences } from './parser';
import { resolveWorkspacePath } from './resolver';
import { OpenCommandArgs, WorkspacePathLinksConfig } from './types';

const COMMAND_ID = 'workspacePathLinks.open';
const SUPPORTED_LANGUAGES = ['javascript', 'javascriptreact', 'typescript', 'typescriptreact'];

function readConfig(): WorkspacePathLinksConfig {
  const config = vscode.workspace.getConfiguration('workspacePathLinks');
  const prefixes = config.get<string[]>('prefixes', ['@/']);

  return {
    enabled: config.get<boolean>('enabled', true),
    prefixes
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
        }
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
              line: reference.line
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
