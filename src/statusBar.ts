import * as vscode from "vscode";
import type { DeliveryState } from "./heartbeat";

export class StatusBar implements vscode.Disposable {
  private readonly item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  private tracking = true;
  private profileNames: string[] = [];
  private delivery: DeliveryState = "idle";

  constructor() {
    this.item.name = "QuarryFi R&D Tracker";
    this.item.command = "quarryfi.showStatus";
    this.render();
    this.item.show();
  }

  setTracking(enabled: boolean): void {
    this.tracking = enabled;
    this.render();
  }

  setProfiles(names: string[]): void {
    this.profileNames = names;
    this.render();
  }

  setDelivery(state: DeliveryState): void {
    this.delivery = state;
    this.render();
  }

  dispose(): void {
    this.item.dispose();
  }

  private render(): void {
    if (!this.tracking) {
      this.item.text = "$(debug-pause) QuarryFi: paused";
      this.item.color = new vscode.ThemeColor("disabledForeground");
      this.item.tooltip = "QuarryFi tracking is paused. Click for status and controls.";
      return;
    }

    if (this.profileNames.length === 0) {
      this.item.text = "$(pulse) QuarryFi: no match";
      this.item.color = new vscode.ThemeColor("editorWarning.foreground");
      this.item.tooltip = "No QuarryFi profile matches the active file. Nothing is being sent.";
      return;
    }

    const label = this.profileNames.length === 1
      ? this.profileNames[0]
      : `${this.profileNames.length} profiles`;
    const icon = this.delivery === "error" ? "warning" : this.delivery === "sending" ? "sync~spin" : "pulse";
    this.item.text = `$(${icon}) QuarryFi: ${label}`;
    this.item.color = this.delivery === "error"
      ? new vscode.ThemeColor("editorWarning.foreground")
      : new vscode.ThemeColor("testing.iconPassed");
    this.item.tooltip = this.delivery === "error"
      ? "QuarryFi could not deliver the latest heartbeat. Click for diagnostics."
      : `Tracking metadata for ${this.profileNames.join(", ")}. Click for status and controls.`;
  }
}
