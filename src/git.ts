import * as path from "node:path";
import { createHash } from "node:crypto";
import * as vscode from "vscode";

interface GitExtension {
  getAPI(version: number): GitAPI;
}

interface GitAPI {
  repositories: GitRepository[];
}

interface GitRepository {
  state: {
    HEAD?: { name?: string; commit?: string };
    remotes?: Array<{ name: string; fetchUrl?: string; pushUrl?: string }>;
    workingTreeChanges?: unknown[];
    indexChanges?: unknown[];
    mergeChanges?: unknown[];
  };
  rootUri: vscode.Uri;
}

export interface GitContext {
  branch: string;
  headSha?: string;
  repoFingerprint?: string;
  changedFileCount: number;
}

export async function getGitContext(documentUri?: vscode.Uri): Promise<GitContext> {
  try {
    const extension = vscode.extensions.getExtension<GitExtension>("vscode.git");
    if (!extension) return { branch: "unknown", changedFileCount: 0 };
    const exports = extension.isActive ? extension.exports : await extension.activate();
    const repositories = exports.getAPI(1).repositories;
    if (repositories.length === 0) return { branch: "unknown", changedFileCount: 0 };

    const repository = documentUri
      ? repositories.find((candidate) => isInside(documentUri.fsPath, candidate.rootUri.fsPath))
      : repositories[0];
    if (!repository) return { branch: "unknown", changedFileCount: 0 };
    const remote = repository.state.remotes?.find((item) => item.name === "origin") ?? repository.state.remotes?.[0];
    const canonicalRepo = canonicalRepositoryName(remote?.fetchUrl ?? remote?.pushUrl);
    return {
      branch: repository.state.HEAD?.name?.slice(0, 200) || "unknown",
      headSha: validSha(repository.state.HEAD?.commit),
      repoFingerprint: canonicalRepo ? createHash("sha256").update(canonicalRepo).digest("hex") : undefined,
      changedFileCount: Math.min(10000,
        (repository.state.workingTreeChanges?.length ?? 0) +
        (repository.state.indexChanges?.length ?? 0) +
        (repository.state.mergeChanges?.length ?? 0)
      ),
    };
  } catch {
    return { branch: "unknown", changedFileCount: 0 };
  }
}

function validSha(value: string | undefined): string | undefined {
  return value && /^[a-f0-9]{7,64}$/i.test(value) ? value.toLowerCase() : undefined;
}

function canonicalRepositoryName(remoteUrl: string | undefined): string | null {
  if (!remoteUrl) return null;
  const match = remoteUrl.trim().match(/(?:github\.com[/:])([^/]+\/[^/]+?)(?:\.git)?$/i);
  return match?.[1]?.replace(/\.git$/i, "").toLowerCase() ?? null;
}

function isInside(candidatePath: string, rootPath: string): boolean {
  const relative = path.relative(rootPath, candidatePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
