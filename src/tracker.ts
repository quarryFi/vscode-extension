import { randomUUID } from "node:crypto";
import * as path from "node:path";
import * as vscode from "vscode";
import { EXTENSION_SOURCE, HEARTBEAT_INTERVAL_MS, SESSION_GAP_MS } from "./constants";
import type { ProfileStore } from "./config";
import { detectEditorDisplayName } from "./editor";
import { getBranch } from "./git";
import type { HeartbeatClient } from "./heartbeat";
import type { StatusBar } from "./statusBar";
import type { Heartbeat } from "./types";

export class Tracker implements vscode.Disposable {
  private lastActivityAt = 0;
  private activitySinceTickAt = 0;
  private lastTickAt = Date.now();
  private lastHeartbeatActivityAt = 0;
  private sessionId = randomUUID();
  private timer: ReturnType<typeof setInterval> | undefined;
  private tickRunning = false;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly profiles: ProfileStore,
    private readonly client: HeartbeatClient,
    private readonly statusBar: StatusBar
  ) {}

  start(): void {
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document === vscode.window.activeTextEditor?.document) this.markActivity();
      }),
      vscode.workspace.onDidSaveTextDocument((document) => {
        if (document === vscode.window.activeTextEditor?.document) this.markActivity();
      }),
      vscode.window.onDidChangeActiveTextEditor(() => {
        this.markActivity();
        void this.updateStatus();
      }),
      vscode.window.onDidChangeWindowState((state) => {
        if (state.focused) void this.updateStatus();
      }),
      this.profiles.onDidChange(() => void this.updateStatus()),
      this.client.onDidChangeState((state) => this.statusBar.setDelivery(state))
    );

    this.timer = setInterval(() => void this.tick(), HEARTBEAT_INTERVAL_MS);
    this.statusBar.setTracking(this.profiles.isTrackingEnabled());
    void this.updateStatus();
  }

  async tickNow(): Promise<void> {
    await this.tick();
  }

  async updateStatus(): Promise<void> {
    this.statusBar.setTracking(this.profiles.isTrackingEnabled());
    const filePath = activeFilePath();
    const matches = await this.profiles.resolveProfiles(filePath);
    this.statusBar.setProfiles(matches.map((profile) => profile.name));
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer);
    this.disposables.forEach((disposable) => disposable.dispose());
  }

  private markActivity(): void {
    if (!vscode.window.state.focused) return;
    const now = Date.now();
    if (this.activitySinceTickAt === 0) this.activitySinceTickAt = now;
    this.lastActivityAt = now;
  }

  private async tick(): Promise<void> {
    if (this.tickRunning) return;
    this.tickRunning = true;

    try {
      const now = Date.now();
      const intervalStartedAt = this.lastTickAt;
      this.lastTickAt = now;
      const activityStartedAt = this.activitySinceTickAt;
      this.activitySinceTickAt = 0;
      if (!this.profiles.isTrackingEnabled() || !vscode.window.state.focused) return;
      if (activityStartedAt === 0) return;

      if (
        this.lastHeartbeatActivityAt > 0 &&
        this.lastActivityAt - this.lastHeartbeatActivityAt > SESSION_GAP_MS
      ) {
        this.sessionId = randomUUID();
      }
      this.lastHeartbeatActivityAt = this.lastActivityAt;

      const editor = vscode.window.activeTextEditor;
      const filePath = activeFilePath();
      const profiles = await this.profiles.resolveProfiles(filePath);
      if (profiles.length === 0) {
        await this.updateStatus();
        return;
      }

      const workspace = editor ? vscode.workspace.getWorkspaceFolder(editor.document.uri) : undefined;
      const durationSeconds = Math.max(
        1,
        Math.min(30, Math.round((now - Math.max(intervalStartedAt, activityStartedAt)) / 1000))
      );
      const heartbeat: Heartbeat = {
        source: EXTENSION_SOURCE,
        project_name: (workspace?.name ?? vscode.workspace.workspaceFolders?.[0]?.name ?? "unknown").slice(0, 200),
        language: (editor?.document.languageId ?? "none").slice(0, 50),
        file_type: fileType(editor),
        branch: await getBranch(editor?.document.uri),
        editor: detectEditorDisplayName(),
        timestamp: new Date(now).toISOString(),
        duration_seconds: durationSeconds,
        session_id: this.sessionId,
      };

      for (const profile of profiles) this.client.enqueue(heartbeat, profile);
      await this.client.flush();
      this.statusBar.setProfiles(profiles.map((profile) => profile.name));
    } finally {
      this.tickRunning = false;
    }
  }
}

function activeFilePath(): string | null {
  return vscode.window.activeTextEditor?.document.uri.fsPath || null;
}

function fileType(editor: vscode.TextEditor | undefined): string {
  if (!editor) return "none";
  const extension = path.extname(editor.document.fileName).toLowerCase();
  return (extension || "none").slice(0, 20);
}
