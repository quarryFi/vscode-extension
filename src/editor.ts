import * as vscode from 'vscode';

export type EditorId = 'vscode' | 'cursor' | 'windsurf';

const DISPLAY_NAMES: Record<EditorId, string> = {
  vscode: 'VS Code',
  cursor: 'Cursor',
  windsurf: 'Windsurf',
};

export function detectEditorId(): EditorId {
  const appName = vscode.env.appName.toLowerCase();

  if (appName.includes('cursor')) {
    return 'cursor';
  }
  if (appName.includes('windsurf')) {
    return 'windsurf';
  }
  return 'vscode';
}

export function detectEditorDisplayName(): string {
  return DISPLAY_NAMES[detectEditorId()];
}
