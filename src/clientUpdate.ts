export interface ClientUpdateNotice {
  source: "vscode";
  currentVersion: string | null;
  latestVersion: string;
  minimumVersion: string;
  updateUrl: string;
  updateAvailable: boolean;
  updateRequired: boolean;
}

export function parseClientUpdate(body: unknown): ClientUpdateNotice | null {
  if (!body || typeof body !== "object") return null;
  const updates = (body as { clientUpdates?: unknown }).clientUpdates;
  if (!Array.isArray(updates)) return null;
  const update = updates.find((candidate) => {
    return !!candidate && typeof candidate === "object" && (candidate as { source?: unknown }).source === "vscode";
  }) as Record<string, unknown> | undefined;
  if (!update || update.updateAvailable !== true) return null;
  if (
    typeof update.latestVersion !== "string" ||
    typeof update.minimumVersion !== "string" ||
    typeof update.updateUrl !== "string"
  ) return null;

  return {
    source: "vscode",
    currentVersion: typeof update.currentVersion === "string" ? update.currentVersion : null,
    latestVersion: update.latestVersion,
    minimumVersion: update.minimumVersion,
    updateUrl: update.updateUrl,
    updateAvailable: true,
    updateRequired: update.updateRequired === true,
  };
}
