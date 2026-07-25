import * as fs from "node:fs";
import * as vscode from "vscode";
import { AuditLog } from "./auditLog";
import { ProfileStore } from "./config";
import { runtimeChannel } from "./editor";
import { HeartbeatClient } from "./heartbeat";
import { importSharedProfiles, manageProfiles } from "./profileWizard";
import { readSharedConfigProfiles } from "./sharedConfig";
import { StatusBar } from "./statusBar";
import { Tracker } from "./tracker";
import type { ClientMetadata } from "./types";

interface Services {
  auditLog: AuditLog;
  client: HeartbeatClient;
  profiles: ProfileStore;
  statusBar: StatusBar;
  tracker: Tracker;
}

let services: Services | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const output = vscode.window.createOutputChannel("QuarryFi", { log: true });
  const profiles = new ProfileStore(context, output);
  const migratedCount = await profiles.initialize();
  const statusBar = new StatusBar();
  const auditLog = new AuditLog(output);
  const metadata = clientMetadata(context);
  const client = new HeartbeatClient(output, auditLog, metadata);
  const tracker = new Tracker(profiles, client, statusBar);

  services = { auditLog, client, profiles, statusBar, tracker };
  context.subscriptions.push(
    output,
    profiles,
    statusBar,
    client,
    tracker,
    vscode.commands.registerCommand("quarryfi.configure", async () => {
      await manageProfiles(profiles);
      await tracker.updateStatus();
    }),
    vscode.commands.registerCommand("quarryfi.importSharedConfig", async () => {
      await importSharedProfiles(profiles);
      await tracker.updateStatus();
    }),
    vscode.commands.registerCommand("quarryfi.showStatus", () => showStatus()),
    vscode.commands.registerCommand("quarryfi.toggleTracking", async () => {
      const enabled = !profiles.isTrackingEnabled();
      await profiles.setTrackingEnabled(enabled);
      statusBar.setTracking(enabled);
      vscode.window.showInformationMessage(`QuarryFi tracking ${enabled ? "resumed" : "paused"}.`);
    }),
    vscode.commands.registerCommand("quarryfi.clearAuditLog", async () => {
      const confirmed = await vscode.window.showWarningMessage(
        "Clear the local QuarryFi VS Code audit log?",
        { modal: true, detail: "This only removes local delivery records. It does not delete data already sent to QuarryFi." },
        "Clear log"
      );
      if (confirmed === "Clear log") {
        await auditLog.clear();
        vscode.window.showInformationMessage("QuarryFi VS Code audit log cleared.");
      }
    }),
    // Compatibility aliases for users upgrading from 0.2.x.
    vscode.commands.registerCommand("quarryfi.setApiKey", () => vscode.commands.executeCommand("quarryfi.configure")),
    vscode.commands.registerCommand("quarryfi.configureProfiles", () => vscode.commands.executeCommand("quarryfi.configure"))
  );

  tracker.start();
  output.appendLine(
    `[QuarryFi] Extension ${metadata.plugin_version} active via ${metadata.runtime_channel}; source-code collection is disabled.`
  );

  if (migratedCount > 0) {
    vscode.window.showInformationMessage(
      `QuarryFi moved ${migratedCount} API-key profile${migratedCount === 1 ? "" : "s"} into encrypted VS Code storage.`
    );
  }

  if ((await profiles.getProfiles()).length === 0 && !profiles.hasShownOnboarding()) {
    await profiles.markOnboardingShown();
    const sharedProfiles = await readSharedConfigProfiles();
    const hasSharedProfiles = sharedProfiles.length > 0;
    void vscode.window.showInformationMessage(
      hasSharedProfiles
        ? `QuarryFi found ${sharedProfiles.length} existing Claude Code / Codex profile${sharedProfiles.length === 1 ? "" : "s"} on this machine. Import into encrypted VS Code storage?`
        : "QuarryFi is installed but not tracking yet. Add a seat-assigned API key and choose the workspaces you want to track.",
      hasSharedProfiles ? "Review & import" : "Configure",
      ...(hasSharedProfiles ? ["Configure manually"] : []),
      "Open dashboard"
    ).then(async (action) => {
      if (action === "Review & import") {
        await vscode.commands.executeCommand("quarryfi.importSharedConfig");
      } else if (action === "Configure" || action === "Configure manually") {
        await vscode.commands.executeCommand("quarryfi.configure");
      } else if (action === "Open dashboard") {
        await vscode.env.openExternal(vscode.Uri.parse("https://quarryfi.com/dashboard/team"));
      }
    });
  }
}

export async function deactivate(): Promise<void> {
  const active = services;
  services = undefined;
  if (!active) return;
  active.tracker.dispose();
  await active.client.flush();
  await active.auditLog.flush();
}

async function showStatus(): Promise<void> {
  const active = services;
  if (!active) return;
  const profiles = await active.profiles.getProfiles();
  const filePath = vscode.window.activeTextEditor?.document.uri.fsPath ?? null;
  const matched = await active.profiles.resolveProfiles(filePath);
  const enabled = active.profiles.isTrackingEnabled();
  const summary = !enabled
    ? "Tracking is paused."
    : profiles.length === 0
      ? "No profile is configured. Nothing is being sent."
      : matched.length === 0
        ? "No profile matches the active file. Nothing is being sent."
        : `Tracking metadata for ${matched.map((profile) => profile.name).join(", ")}.`;
  const detail = `${active.client.pendingCount} queued · delivery ${active.client.deliveryState}`;
  const action = await vscode.window.showInformationMessage(
    `QuarryFi: ${summary} ${detail}`,
    "Configure",
    enabled ? "Pause" : "Resume",
    "View audit log"
  );

  if (action === "Configure") {
    await vscode.commands.executeCommand("quarryfi.configure");
  } else if (action === "Pause" || action === "Resume") {
    await vscode.commands.executeCommand("quarryfi.toggleTracking");
  } else if (action === "View audit log") {
    if (!fs.existsSync(active.auditLog.path)) {
      vscode.window.showInformationMessage("No QuarryFi VS Code deliveries have been logged yet.");
      return;
    }
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(active.auditLog.path));
    await vscode.window.showTextDocument(document, { preview: true });
  }
}

function clientMetadata(context: vscode.ExtensionContext): ClientMetadata {
  const version = String(context.extension.packageJSON.version ?? "unknown").slice(0, 50);
  return {
    plugin_version: version,
    runtime_channel: runtimeChannel(),
    hook_mode: "editor_activity_30s",
    install_revision: `${context.extension.id}@${version}`.slice(0, 100),
    host_app: "vscode",
  };
}
