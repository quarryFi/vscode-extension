import * as vscode from 'vscode';

const SECTION = 'quarryfi';
const DEFAULT_API_URL = 'https://quarryfi.smashedstudiosllc.workers.dev';

export interface Profile {
  name: string;
  apiKey: string;
  apiUrl: string;
  workspaceFolders: string[];
}

export function profileId(profile: Profile): string {
  return profile.name;
}

export function getProfiles(): Profile[] {
  const config = vscode.workspace.getConfiguration(SECTION);
  const profiles = config.get<Profile[]>('profiles', []);

  if (profiles.length > 0) {
    return profiles.map((p) => ({
      ...p,
      apiUrl: (p.apiUrl || DEFAULT_API_URL).replace(/\/+$/, ''),
      workspaceFolders: p.workspaceFolders ?? [],
    }));
  }

  // Legacy fallback: single apiKey/apiUrl treated as catch-all
  const apiKey = config.get<string>('apiKey', '');
  if (apiKey) {
    return [
      {
        name: 'Default',
        apiKey,
        apiUrl: config.get<string>('apiUrl', DEFAULT_API_URL)!.replace(/\/+$/, ''),
        workspaceFolders: [],
      },
    ];
  }

  return [];
}

export function resolveProfiles(filePath: string | null): Profile[] {
  // No file open — only catch-all profiles apply
  if (!filePath) {
    return getProfiles().filter((p) => p.workspaceFolders.length === 0);
  }

  const normalized = filePath.replace(/\\/g, '/');
  return getProfiles().filter((profile) => {
    if (profile.workspaceFolders.length === 0) {
      return true; // catch-all
    }
    return profile.workspaceFolders.some((folder) => {
      const normalizedFolder = folder.replace(/\\/g, '/').replace(/\/+$/, '');
      return normalized.startsWith(normalizedFolder + '/') || normalized === normalizedFolder;
    });
  });
}

// Legacy compat — reads from first profile or direct settings
export function getApiKey(): string {
  const profiles = getProfiles();
  return profiles[0]?.apiKey ?? '';
}

export function getApiUrl(): string {
  const profiles = getProfiles();
  return profiles[0]?.apiUrl ?? DEFAULT_API_URL;
}

export async function promptForApiKey(): Promise<string | undefined> {
  const key = await vscode.window.showInputBox({
    prompt: 'Enter your QuarryFi API key',
    placeHolder: 'qf_...',
    password: true,
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value.startsWith('qf_')) {
        return 'API key should start with qf_';
      }
      return null;
    },
  });

  if (key) {
    await vscode.workspace
      .getConfiguration(SECTION)
      .update('apiKey', key, vscode.ConfigurationTarget.Global);
  }

  return key;
}

export async function addProfile(profile: Profile): Promise<void> {
  const config = vscode.workspace.getConfiguration(SECTION);
  const existing = config.get<Profile[]>('profiles', []);
  existing.push(profile);
  await config.update('profiles', existing, vscode.ConfigurationTarget.Global);
}
