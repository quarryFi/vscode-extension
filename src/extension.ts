import * as vscode from 'vscode';
import { getApiKey, promptForApiKey } from './config';
import { StatusBar } from './statusBar';
import { Tracker } from './tracker';
import { flush, dispose as disposeHeartbeat } from './heartbeat';

let tracker: Tracker | undefined;
let statusBar: StatusBar | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  statusBar = new StatusBar();
  tracker = new Tracker(statusBar);

  context.subscriptions.push(
    vscode.commands.registerCommand('quarryfi.setApiKey', async () => {
      await promptForApiKey();
      vscode.window.showInformationMessage('QuarryFi API key saved.');
    }),

    vscode.commands.registerCommand('quarryfi.toggleTracking', () => {
      statusBar!.toggle();
      const state = statusBar!.isTracking ? 'resumed' : 'paused';
      vscode.window.showInformationMessage(`QuarryFi tracking ${state}.`);
    }),

    { dispose: () => statusBar?.dispose() },
    { dispose: () => tracker?.dispose() },
    { dispose: () => disposeHeartbeat() },
  );

  tracker.start();

  // Prompt for API key on first activation if not set
  if (!getApiKey()) {
    const action = await vscode.window.showInformationMessage(
      'QuarryFi: No API key configured. Set one now to start tracking.',
      'Set API Key',
      'Later'
    );
    if (action === 'Set API Key') {
      await promptForApiKey();
    }
  }
}

export function deactivate(): void {
  flush();
}
