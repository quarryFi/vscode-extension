import * as vscode from 'vscode';
import * as path from 'path';
import { enqueue, type Heartbeat } from './heartbeat';
import { getBranch } from './git';
import { detectEditor } from './editor';
import { StatusBar } from './statusBar';

const HEARTBEAT_INTERVAL_MS = 30_000;

export class Tracker {
  private lastActivity = 0;
  private timer: ReturnType<typeof setInterval> | undefined;
  private disposables: vscode.Disposable[] = [];
  private statusBar: StatusBar;

  constructor(statusBar: StatusBar) {
    this.statusBar = statusBar;
  }

  start(): void {
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(() => this.onActivity()),
      vscode.window.onDidChangeActiveTextEditor(() => this.onActivity()),
      vscode.workspace.onDidSaveTextDocument(() => this.onActivity()),
    );

    this.timer = setInterval(() => this.tick(), HEARTBEAT_INTERVAL_MS);
  }

  private onActivity(): void {
    this.lastActivity = Date.now();
  }

  private tick(): void {
    if (!this.statusBar.isTracking) {
      return;
    }

    const now = Date.now();
    if (now - this.lastActivity > HEARTBEAT_INTERVAL_MS) {
      return; // no activity since last tick — skip
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const doc = editor.document;
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const ext = path.extname(doc.fileName).replace(/^\./, '');

    const heartbeat: Heartbeat = {
      source: 'vscode',
      project_name: workspaceFolder?.name ?? 'unknown',
      language: doc.languageId,
      file_type: ext || 'unknown',
      branch: getBranch() ?? null,
      editor: detectEditor(),
      timestamp: new Date().toISOString(),
      duration_seconds: 30,
    };

    enqueue(heartbeat);
  }

  dispose(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.disposables.forEach((d) => d.dispose());
  }
}
