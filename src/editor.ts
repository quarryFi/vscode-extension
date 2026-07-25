import * as vscode from "vscode";

export type EditorId = "vscode" | "cursor" | "windsurf" | "compatible";

export function detectEditorId(): EditorId {
  const appName = vscode.env.appName.toLowerCase();
  if (appName.includes("cursor")) return "cursor";
  if (appName.includes("windsurf")) return "windsurf";
  if (appName.includes("visual studio code") || appName.includes("code")) return "vscode";
  return "compatible";
}

export function detectEditorDisplayName(): string {
  return vscode.env.appName.trim().slice(0, 100) || "VS Code";
}

export function runtimeChannel(): string {
  return `${detectEditorId()}_extension`;
}
