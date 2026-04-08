import * as vscode from 'vscode';

export type EditorName = 'vscode' | 'cursor' | 'windsurf';

export function detectEditor(): EditorName {
  const appName = vscode.env.appName.toLowerCase();

  if (appName.includes('cursor')) {
    return 'cursor';
  }
  if (appName.includes('windsurf')) {
    return 'windsurf';
  }
  return 'vscode';
}
