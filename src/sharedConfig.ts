import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { API_KEY_PATTERN } from "./constants";

const MAX_SHARED_CONFIG_BYTES = 1_048_576;
const MAX_PROFILES = 25;
const MAX_WORKSPACE_FOLDERS = 100;

export interface SharedConfigProfile {
  name: string;
  apiKey: string;
  workspaceFolders: string[];
  matchAll: boolean;
}

export function sharedConfigPath(): string {
  return path.join(os.homedir(), ".quarryfi", "config.json");
}

export async function readSharedConfigProfiles(): Promise<SharedConfigProfile[]> {
  const configPath = sharedConfigPath();
  try {
    const stat = await fs.stat(configPath);
    if (!stat.isFile() || stat.size > MAX_SHARED_CONFIG_BYTES) return [];
    return parseSharedConfig(await fs.readFile(configPath, "utf8"));
  } catch {
    return [];
  }
}

export function parseSharedConfig(raw: string): SharedConfigProfile[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!isRecord(parsed)) return [];

  const rawProfiles = Array.isArray(parsed.profiles) ? parsed.profiles : [parsed];
  const seenKeys = new Set<string>();
  const profiles: SharedConfigProfile[] = [];

  for (const value of rawProfiles.slice(0, MAX_PROFILES)) {
    if (!isRecord(value)) continue;
    const apiKey = typeof value.api_key === "string" ? value.api_key.trim() : "";
    if (!API_KEY_PATTERN.test(apiKey) || seenKeys.has(apiKey)) continue;

    const rawFolders = Array.isArray(value.projects)
      ? value.projects
      : Array.isArray(value.project_dirs)
        ? value.project_dirs
        : [];
    const workspaceFolders = [...new Set(
      rawFolders
        .filter((folder): folder is string => typeof folder === "string")
        .map((folder) => folder.trim())
        .filter(Boolean)
        .slice(0, MAX_WORKSPACE_FOLDERS)
    )];

    seenKeys.add(apiKey);
    profiles.push({
      name: cleanName(value.name) || "Imported QuarryFi profile",
      apiKey,
      workspaceFolders,
      matchAll: workspaceFolders.length === 0,
    });
  }

  return profiles;
}

export function maskApiKey(apiKey: string): string {
  return `${apiKey.slice(0, 3)}...${apiKey.slice(-4)}`;
}

function cleanName(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 80) : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
