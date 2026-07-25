import { randomUUID } from "node:crypto";
import * as vscode from "vscode";
import { API_KEY_PATTERN } from "./constants";
import { resolveMatchingProfiles } from "./profileMatching";
import type { Profile, StoredProfile } from "./types";

const PROFILE_STATE_KEY = "quarryfi.profiles.v2";
const TRACKING_STATE_KEY = "quarryfi.trackingEnabled";
const ONBOARDING_STATE_KEY = "quarryfi.onboardingPromptShown";
const SECRET_PREFIX = "quarryfi.profile.";

interface LegacyProfile {
  name?: unknown;
  apiKey?: unknown;
  workspaceFolders?: unknown;
}

export interface ProfileInput {
  name: string;
  apiKey: string;
  workspaceFolders: string[];
  matchAll: boolean;
}

export class ProfileStore implements vscode.Disposable {
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChange = this.changeEmitter.event;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly output: vscode.OutputChannel
  ) {}

  async initialize(): Promise<number> {
    const config = vscode.workspace.getConfiguration("quarryfi");
    const legacyProfiles = config.get<LegacyProfile[]>("profiles", []);
    const legacyApiKey = config.get<string>("apiKey", "");
    const existing = this.getStoredProfiles();
    const existingKeys = new Set((await this.getProfiles()).map((profile) => profile.apiKey));
    const migrated: StoredProfile[] = [];

    for (const legacy of legacyProfiles) {
      const apiKey = typeof legacy.apiKey === "string" ? legacy.apiKey.trim() : "";
      if (!API_KEY_PATTERN.test(apiKey) || existingKeys.has(apiKey)) continue;

      const workspaceFolders = Array.isArray(legacy.workspaceFolders)
        ? legacy.workspaceFolders.filter((folder): folder is string => typeof folder === "string" && folder.length > 0)
        : [];
      const id = randomUUID();
      await this.context.secrets.store(secretKey(id), apiKey);
      existingKeys.add(apiKey);
      migrated.push({
        id,
        name: cleanProfileName(legacy.name) || "Migrated profile",
        workspaceFolders,
        matchAll: workspaceFolders.length === 0,
      });
    }

    if (API_KEY_PATTERN.test(legacyApiKey.trim()) && !existingKeys.has(legacyApiKey.trim())) {
      const id = randomUUID();
      await this.context.secrets.store(secretKey(id), legacyApiKey.trim());
      migrated.push({
        id,
        name: "Default",
        workspaceFolders: [],
        matchAll: true,
      });
    }

    if (migrated.length > 0) {
      await this.context.globalState.update(PROFILE_STATE_KEY, [...existing, ...migrated]);
    }

    try {
      await config.update("profiles", undefined, vscode.ConfigurationTarget.Global);
      await config.update("apiKey", undefined, vscode.ConfigurationTarget.Global);
      await config.update("apiUrl", undefined, vscode.ConfigurationTarget.Global);
    } catch (error) {
      this.output.appendLine(`[QuarryFi] Plaintext settings cleanup failed: ${errorMessage(error)}`);
      return migrated.length;
    }

    if (migrated.length > 0) {
      this.output.appendLine(
        `[QuarryFi] Migrated ${migrated.length} profile${migrated.length === 1 ? "" : "s"} to encrypted SecretStorage.`
      );
      this.changeEmitter.fire();
    }

    return migrated.length;
  }

  async getProfiles(): Promise<Profile[]> {
    const profiles: Profile[] = [];
    for (const stored of this.getStoredProfiles()) {
      const apiKey = await this.context.secrets.get(secretKey(stored.id));
      if (!apiKey || !API_KEY_PATTERN.test(apiKey)) continue;
      profiles.push({ ...stored, apiKey });
    }
    return profiles;
  }

  async resolveProfiles(filePath: string | null): Promise<Profile[]> {
    return resolveMatchingProfiles(await this.getProfiles(), filePath);
  }

  async add(input: ProfileInput): Promise<StoredProfile> {
    assertProfileInput(input);
    const profile: StoredProfile = {
      id: randomUUID(),
      name: input.name.trim(),
      workspaceFolders: uniqueFolders(input.workspaceFolders),
      matchAll: input.matchAll,
    };

    await this.context.secrets.store(secretKey(profile.id), input.apiKey.trim());
    try {
      await this.context.globalState.update(PROFILE_STATE_KEY, [...this.getStoredProfiles(), profile]);
    } catch (error) {
      await this.context.secrets.delete(secretKey(profile.id));
      throw error;
    }
    this.changeEmitter.fire();
    return profile;
  }

  async update(id: string, input: ProfileInput): Promise<void> {
    assertProfileInput(input);
    const profiles = this.getStoredProfiles();
    const index = profiles.findIndex((profile) => profile.id === id);
    if (index < 0) throw new Error("Profile not found.");

    await this.context.secrets.store(secretKey(id), input.apiKey.trim());
    profiles[index] = {
      id,
      name: input.name.trim(),
      workspaceFolders: uniqueFolders(input.workspaceFolders),
      matchAll: input.matchAll,
    };
    await this.context.globalState.update(PROFILE_STATE_KEY, profiles);
    this.changeEmitter.fire();
  }

  async remove(id: string): Promise<void> {
    await this.context.secrets.delete(secretKey(id));
    await this.context.globalState.update(
      PROFILE_STATE_KEY,
      this.getStoredProfiles().filter((profile) => profile.id !== id)
    );
    this.changeEmitter.fire();
  }

  isTrackingEnabled(): boolean {
    return this.context.globalState.get<boolean>(TRACKING_STATE_KEY, true);
  }

  async setTrackingEnabled(enabled: boolean): Promise<void> {
    await this.context.globalState.update(TRACKING_STATE_KEY, enabled);
    this.changeEmitter.fire();
  }

  hasShownOnboarding(): boolean {
    return this.context.globalState.get<boolean>(ONBOARDING_STATE_KEY, false);
  }

  async markOnboardingShown(): Promise<void> {
    await this.context.globalState.update(ONBOARDING_STATE_KEY, true);
  }

  dispose(): void {
    this.changeEmitter.dispose();
  }

  private getStoredProfiles(): StoredProfile[] {
    const raw = this.context.globalState.get<unknown>(PROFILE_STATE_KEY, []);
    if (!Array.isArray(raw)) return [];

    return raw.flatMap((value): StoredProfile[] => {
      if (!value || typeof value !== "object") return [];
      const record = value as Record<string, unknown>;
      if (typeof record.id !== "string" || typeof record.name !== "string") return [];
      const workspaceFolders = Array.isArray(record.workspaceFolders)
        ? record.workspaceFolders.filter((folder): folder is string => typeof folder === "string")
        : [];
      return [{
        id: record.id,
        name: record.name,
        workspaceFolders,
        matchAll: record.matchAll === true,
      }];
    });
  }
}

export function isValidApiKey(value: string): boolean {
  return API_KEY_PATTERN.test(value.trim());
}

function secretKey(id: string): string {
  return `${SECRET_PREFIX}${id}.apiKey`;
}

function cleanProfileName(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 80) : "";
}

function uniqueFolders(folders: string[]): string[] {
  return [...new Set(folders.map((folder) => folder.trim()).filter(Boolean))];
}

function assertProfileInput(input: ProfileInput): void {
  if (!input.name.trim()) throw new Error("Profile name is required.");
  if (!isValidApiKey(input.apiKey)) throw new Error("API key must use the qf_ format shown in QuarryFi.");
  if (!input.matchAll && input.workspaceFolders.length === 0) {
    throw new Error("Choose at least one workspace folder or explicitly track all workspaces.");
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
