import * as vscode from 'vscode';
import { getProfiles, promptForApiKey, addProfile, type Profile } from './config';
import { StatusBar } from './statusBar';
import { Tracker } from './tracker';
import { init as initHeartbeat, flush, dispose as disposeHeartbeat } from './heartbeat';
import { init as initAuditLog } from './auditLog';

let tracker: Tracker | undefined;
let statusBar: StatusBar | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const outputChannel = vscode.window.createOutputChannel('QuarryFi');

  initHeartbeat(outputChannel);
  initAuditLog(outputChannel);

  statusBar = new StatusBar();
  tracker = new Tracker(statusBar);

  context.subscriptions.push(
    outputChannel,

    vscode.commands.registerCommand('quarryfi.setApiKey', async () => {
      await promptForApiKey();
      vscode.window.showInformationMessage('QuarryFi API key saved.');
    }),

    vscode.commands.registerCommand('quarryfi.toggleTracking', () => {
      statusBar!.toggle();
      const state = statusBar!.isTracking ? 'resumed' : 'paused';
      vscode.window.showInformationMessage(`QuarryFi tracking ${state}.`);
    }),

    vscode.commands.registerCommand('quarryfi.configureProfiles', () =>
      configureProfilesWizard()
    ),

    { dispose: () => statusBar?.dispose() },
    { dispose: () => tracker?.dispose() },
    { dispose: () => disposeHeartbeat() },
  );

  tracker.start();

  if (getProfiles().length === 0) {
    const action = await vscode.window.showInformationMessage(
      'QuarryFi: No API key or profiles configured. Set up now to start tracking.',
      'Configure Profiles',
      'Set API Key',
      'Later'
    );
    if (action === 'Configure Profiles') {
      await configureProfilesWizard();
    } else if (action === 'Set API Key') {
      await promptForApiKey();
    }
  }
}

export function deactivate(): void {
  flush();
}

async function configureProfilesWizard(): Promise<void> {
  let addAnother = true;

  while (addAnother) {
    const name = await vscode.window.showInputBox({
      prompt: 'Profile name (e.g., company name)',
      placeHolder: 'Acme Corp',
      ignoreFocusOut: true,
    });
    if (!name) {
      return;
    }

    const apiKey = await vscode.window.showInputBox({
      prompt: `API key for "${name}"`,
      placeHolder: 'qf_...',
      password: true,
      ignoreFocusOut: true,
      validateInput: (v) => (v.startsWith('qf_') ? null : 'API key should start with qf_'),
    });
    if (!apiKey) {
      return;
    }

    const apiUrl = await vscode.window.showInputBox({
      prompt: `API endpoint URL for "${name}"`,
      value: 'https://quarryfi.smashedstudiosllc.workers.dev',
      ignoreFocusOut: true,
    });
    if (apiUrl === undefined) {
      return;
    }

    const folders = vscode.workspace.workspaceFolders ?? [];
    let workspaceFolders: string[] = [];

    if (folders.length > 0) {
      const picks = folders.map((f) => ({ label: f.name, description: f.uri.fsPath, picked: false }));
      picks.unshift({ label: 'Match all files (catch-all)', description: 'No folder restriction', picked: false });

      const selected = await vscode.window.showQuickPick(picks, {
        canPickMany: true,
        placeHolder: 'Select workspace folders for this profile',
        ignoreFocusOut: true,
      });

      if (!selected) {
        return;
      }

      const isCatchAll = selected.some((s) => s.label === 'Match all files (catch-all)');
      if (!isCatchAll) {
        workspaceFolders = selected.map((s) => s.description!).filter((d) => d !== 'No folder restriction');
      }
    }

    const profile: Profile = {
      name,
      apiKey,
      apiUrl: (apiUrl || 'https://quarryfi.smashedstudiosllc.workers.dev').replace(/\/+$/, ''),
      workspaceFolders,
    };

    await addProfile(profile);
    vscode.window.showInformationMessage(`QuarryFi: Profile "${name}" added.`);

    const more = await vscode.window.showQuickPick(['Yes', 'No'], {
      placeHolder: 'Add another profile?',
    });
    addAnother = more === 'Yes';
  }
}
