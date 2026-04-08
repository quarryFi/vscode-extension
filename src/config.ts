import * as vscode from 'vscode';

const SECTION = 'quarryfi';

export function getApiKey(): string {
  return vscode.workspace.getConfiguration(SECTION).get<string>('apiKey', '');
}

export function getApiUrl(): string {
  const url = vscode.workspace.getConfiguration(SECTION).get<string>(
    'apiUrl',
    'https://quarryfi.smashedstudiosllc.workers.dev'
  );
  return url.replace(/\/+$/, '');
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
