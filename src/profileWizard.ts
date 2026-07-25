import * as path from "node:path";
import * as vscode from "vscode";
import { API_BASE_URL, API_KEY_PATTERN, DASHBOARD_URL, REQUEST_TIMEOUT_MS } from "./constants";
import type { ProfileInput, ProfileStore } from "./config";
import type { Profile } from "./types";

interface FolderPick extends vscode.QuickPickItem {
  folderPath?: string;
  matchAll?: boolean;
}

export async function manageProfiles(store: ProfileStore): Promise<void> {
  const profiles = await store.getProfiles();
  const action = await vscode.window.showQuickPick(
    [
      { label: "$(add) Add profile", action: "add" },
      ...(profiles.length > 0
        ? [
            { label: "$(edit) Edit profile", action: "edit" },
            { label: "$(trash) Remove profile", action: "remove" },
          ]
        : []),
      { label: "$(link-external) Open QuarryFi dashboard", action: "dashboard" },
    ],
    {
      title: "QuarryFi tracking profiles",
      placeHolder: profiles.length === 0 ? "Add a profile to start tracking" : "Choose an action",
      ignoreFocusOut: true,
    }
  );

  if (!action) return;
  if (action.action === "dashboard") {
    await vscode.env.openExternal(vscode.Uri.parse(DASHBOARD_URL));
    return;
  }
  if (action.action === "add") {
    const input = await collectProfileInput();
    if (!input) return;
    const profile = await store.add(input);
    vscode.window.showInformationMessage(`QuarryFi profile "${profile.name}" is ready.`);
    return;
  }

  const selected = await pickProfile(profiles, action.action === "edit" ? "Edit a profile" : "Remove a profile");
  if (!selected) return;
  if (action.action === "edit") {
    const input = await collectProfileInput(selected);
    if (!input) return;
    await store.update(selected.id, input);
    vscode.window.showInformationMessage(`QuarryFi profile "${input.name}" was updated.`);
    return;
  }

  const confirmation = await vscode.window.showWarningMessage(
    `Remove QuarryFi profile "${selected.name}" and its encrypted API key?`,
    { modal: true },
    "Remove"
  );
  if (confirmation === "Remove") {
    await store.remove(selected.id);
    vscode.window.showInformationMessage(`QuarryFi profile "${selected.name}" was removed.`);
  }
}

export async function verifyApiKey(apiKey: string): Promise<{ ok: boolean; retryable: boolean; message: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_URL}/api/status`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    if (response.ok) return { ok: true, retryable: false, message: "API key verified." };

    const message = await responseError(response);
    return {
      ok: false,
      retryable: response.status >= 500 || response.status === 429,
      message: `QuarryFi rejected this key (HTTP ${response.status}): ${message}`,
    };
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? "QuarryFi did not respond before the request timed out."
      : "QuarryFi could not be reached. Check your connection.";
    return { ok: false, retryable: true, message };
  } finally {
    clearTimeout(timeout);
  }
}

async function collectProfileInput(existing?: Profile): Promise<ProfileInput | undefined> {
  const name = await vscode.window.showInputBox({
    title: existing ? "Edit QuarryFi profile" : "Add QuarryFi profile",
    prompt: "Company or account name",
    value: existing?.name ?? "",
    placeHolder: "Acme Corp",
    ignoreFocusOut: true,
    validateInput: (value) => value.trim() ? null : "Profile name is required.",
  });
  if (!name) return undefined;

  const enteredKey = await vscode.window.showInputBox({
    title: "QuarryFi API key",
    prompt: existing
      ? "Leave blank to keep the current encrypted key"
      : "Paste the seat-assigned key from Dashboard → Team",
    placeHolder: existing ? "Current key will be kept" : "qf_…",
    password: true,
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (existing && value.length === 0) return null;
      return API_KEY_PATTERN.test(value.trim())
        ? null
        : "Expected qf_ followed by 40 lowercase hexadecimal characters.";
    },
  });
  if (enteredKey === undefined) return undefined;
  const apiKey = enteredKey.trim() || existing?.apiKey || "";

  if (enteredKey.trim()) {
    const verification = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "Verifying QuarryFi API key…" },
      () => verifyApiKey(apiKey)
    );
    if (!verification.ok) {
      if (!verification.retryable) {
        vscode.window.showErrorMessage(verification.message);
        return undefined;
      }
      const saveAnyway = await vscode.window.showWarningMessage(
        verification.message,
        { modal: true, detail: "The key can be saved securely now and verified when QuarryFi is reachable." },
        "Save anyway"
      );
      if (saveAnyway !== "Save anyway") return undefined;
    }
  }

  const scope = await pickFolders(existing);
  if (!scope) return undefined;
  return {
    name: name.trim(),
    apiKey,
    workspaceFolders: scope.workspaceFolders,
    matchAll: scope.matchAll,
  };
}

async function pickFolders(
  existing?: Profile
): Promise<{ workspaceFolders: string[]; matchAll: boolean } | undefined> {
  const currentFolders = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath) ?? [];
  const knownFolders = [...new Set([...currentFolders, ...(existing?.workspaceFolders ?? [])])];
  const picks: FolderPick[] = [
    {
      label: "$(globe) Track all workspaces",
      description: "Explicit catch-all; use only when every VS Code project belongs to this QuarryFi account",
      matchAll: true,
      picked: existing?.matchAll === true,
    },
    ...knownFolders.map((folderPath) => ({
      label: path.basename(folderPath) || folderPath,
      description: folderPath,
      folderPath,
      picked: existing?.workspaceFolders.includes(folderPath) ?? false,
    })),
  ];

  const selected = await vscode.window.showQuickPick(picks, {
    title: "Choose which workspaces this profile may track",
    placeHolder: "No unselected workspace sends metadata",
    canPickMany: true,
    ignoreFocusOut: true,
  });
  if (!selected) return undefined;
  const matchAll = selected.some((item) => item.matchAll);
  const workspaceFolders = selected.flatMap((item) => item.folderPath ? [item.folderPath] : []);
  if (!matchAll && workspaceFolders.length === 0) {
    vscode.window.showErrorMessage("Choose at least one workspace folder or explicitly select Track all workspaces.");
    return undefined;
  }
  if (matchAll && workspaceFolders.length > 0) {
    vscode.window.showInformationMessage("Track all workspaces overrides individual folder selections for this profile.");
  }
  return { workspaceFolders: matchAll ? [] : workspaceFolders, matchAll };
}

async function pickProfile(profiles: Profile[], title: string): Promise<Profile | undefined> {
  const selected = await vscode.window.showQuickPick(
    profiles.map((profile) => ({
      label: profile.name,
      description: profile.matchAll
        ? "All workspaces"
        : `${profile.workspaceFolders.length} workspace${profile.workspaceFolders.length === 1 ? "" : "s"}`,
      profile,
    })),
    { title, ignoreFocusOut: true }
  );
  return selected?.profile;
}

async function responseError(response: Response): Promise<string> {
  try {
    const body = await response.json() as { error?: unknown };
    if (typeof body.error === "string") return body.error.slice(0, 240);
  } catch {
    // Fall back to the HTTP status text.
  }
  return response.statusText;
}
