import * as path from "node:path";
import type { Profile } from "./types";

export function normalizeFsPath(value: string, platform: NodeJS.Platform = process.platform): string {
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  const normalized = pathApi.normalize(value).replace(/[\\/]+$/, "");
  return platform === "win32" ? normalized.toLowerCase() : normalized;
}

export function pathMatchesFolder(
  filePath: string,
  folderPath: string,
  platform: NodeJS.Platform = process.platform
): boolean {
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  const file = normalizeFsPath(filePath, platform);
  const folder = normalizeFsPath(folderPath, platform);
  if (!file || !folder) return false;
  if (file === folder) return true;
  return file.startsWith(folder + pathApi.sep);
}

export function resolveMatchingProfiles(
  profiles: Profile[],
  filePath: string | null,
  platform: NodeJS.Platform = process.platform
): Profile[] {
  return profiles.filter((profile) => {
    if (profile.matchAll) return true;
    if (!filePath) return false;
    return profile.workspaceFolders.some((folder) => pathMatchesFolder(filePath, folder, platform));
  });
}
