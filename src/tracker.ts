import * as vscode from 'vscode';
import * as path from 'path';
import * as crypto from 'crypto';
import { enqueue, type Heartbeat } from './heartbeat';
import { resolveProfiles } from './config';
import { getBranch } from './git';
import { detectEditorId, detectEditorDisplayName } from './editor';
import { StatusBar } from './statusBar';

const HEARTBEAT_INTERVAL_MS = 30_000;
const SESSION_GAP_MS = 5 * 60_000; // 5 minutes of inactivity = new session

export class Tracker {
  private lastActivity = 0;
  private lastHeartbeatActivity = 0; // timestamp of lastActivity at previous heartbeat
  private timer: ReturnType<typeof setInterval> | undefined;
  private disposables: vscode.Disposable[] = [];
  private statusBar: StatusBar;
  private sessionId: string = crypto.randomUUID();

  constructor(statusBar: StatusBar) {
    this.statusBar = statusBar;
  }

  start(): void {
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(() => this.onActivity()),
      vscode.window.onDidChangeActiveTextEditor(() => {
        this.onActivity();
        this.updateStatusBarProfile();
      }),
      vscode.workspace.onDidSaveTextDocument(() => this.onActivity()),
    );

    this.timer = setInterval(() => this.tick(), HEARTBEAT_INTERVAL_MS);
    this.updateStatusBarProfile();
  }

  private onActivity(): void {
    this.lastActivity = Date.now();
  }

  private updateStatusBarProfile(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this.statusBar.setActiveProfile(null);
      return;
    }
    const profiles = resolveProfiles(editor.document.uri.fsPath);
    this.statusBar.setActiveProfile(profiles[0]?.name ?? null);
  }

  private tick(): void {
    if (!this.statusBar.isTracking) {
      return;
    }

    const now = Date.now();
    if (now - this.lastActivity > HEARTBEAT_INTERVAL_MS) {
      return; // no activity since last tick — skip
    }

    // Rotate session if there was a >5 min gap since the last heartbeat's activity
    if (this.lastHeartbeatActivity > 0 && this.lastActivity - this.lastHeartbeatActivity > SESSION_GAP_MS) {
      this.sessionId = crypto.randomUUID();
    }
    this.lastHeartbeatActivity = this.lastActivity;

    const editor = vscode.window.activeTextEditor;

    // Resolve profiles: use file path if editor is open, catch-all only if not
    const filePath = editor?.document.uri.fsPath ?? null;
    const profiles = resolveProfiles(filePath);
    if (profiles.length === 0) {
      return;
    }

    // Determine project name from the workspace folder that contains the active file
    let projectName = 'unknown';
    if (editor) {
      const folder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
      projectName = folder?.name ?? vscode.workspace.workspaceFolders?.[0]?.name ?? 'unknown';
    } else {
      projectName = vscode.workspace.workspaceFolders?.[0]?.name ?? 'unknown';
    }

    // Determine language and file_type
    let language: string;
    let fileType: string;
    if (editor) {
      language = editor.document.languageId;
      const ext = path.extname(editor.document.fileName);
      fileType = ext || 'none'; // ext includes dot, e.g. ".ts"
    } else {
      // No file open — user is in settings, terminal, extension panel, etc.
      language = 'none';
      fileType = 'none';
    }

    const heartbeat: Heartbeat = {
      source: detectEditorId(),
      project_name: projectName,
      language,
      file_type: fileType,
      branch: getBranch() ?? 'unknown',
      editor: detectEditorDisplayName(),
      timestamp: new Date().toISOString(),
      duration_seconds: 30,
      session_id: this.sessionId,
    };

    for (const profile of profiles) {
      enqueue(heartbeat, profile);
    }
  }

  dispose(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.disposables.forEach((d) => d.dispose());
  }
}
