import * as vscode from 'vscode';

interface GitExtension {
  getAPI(version: number): GitAPI;
}

interface GitAPI {
  repositories: GitRepository[];
}

interface GitRepository {
  state: { HEAD?: { name?: string } };
  rootUri: vscode.Uri;
}

export function getBranch(): string | undefined {
  try {
    const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git');
    if (!gitExtension?.isActive) {
      return undefined;
    }

    const api = gitExtension.exports.getAPI(1);
    if (api.repositories.length === 0) {
      return undefined;
    }

    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      const repo = api.repositories.find((r) =>
        activeEditor.document.uri.fsPath.startsWith(r.rootUri.fsPath)
      );
      if (repo) {
        return repo.state.HEAD?.name;
      }
    }

    return api.repositories[0].state.HEAD?.name;
  } catch {
    return undefined;
  }
}
