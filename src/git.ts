import * as path from "node:path";
import * as vscode from "vscode";

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

export async function getBranch(documentUri?: vscode.Uri): Promise<string> {
  try {
    const extension = vscode.extensions.getExtension<GitExtension>("vscode.git");
    if (!extension) return "unknown";
    const exports = extension.isActive ? extension.exports : await extension.activate();
    const repositories = exports.getAPI(1).repositories;
    if (repositories.length === 0) return "unknown";

    const repository = documentUri
      ? repositories.find((candidate) => isInside(documentUri.fsPath, candidate.rootUri.fsPath))
      : repositories[0];
    return repository?.state.HEAD?.name?.slice(0, 200) || "unknown";
  } catch {
    return "unknown";
  }
}

function isInside(candidatePath: string, rootPath: string): boolean {
  const relative = path.relative(rootPath, candidatePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
