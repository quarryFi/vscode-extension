import * as vscode from 'vscode';

export class StatusBar {
  private item: vscode.StatusBarItem;
  private _tracking = true;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.command = 'quarryfi.toggleTracking';
    this.update();
    this.item.show();
  }

  get isTracking(): boolean {
    return this._tracking;
  }

  toggle(): void {
    this._tracking = !this._tracking;
    this.update();
  }

  private update(): void {
    if (this._tracking) {
      this.item.text = '$(pulse) quarryFi: tracking';
      this.item.color = new vscode.ThemeColor('testing.iconPassed');
      this.item.tooltip = 'QuarryFi is tracking activity. Click to pause.';
    } else {
      this.item.text = '$(debug-pause) quarryFi: paused';
      this.item.color = new vscode.ThemeColor('disabledForeground');
      this.item.tooltip = 'QuarryFi tracking is paused. Click to resume.';
    }
  }

  dispose(): void {
    this.item.dispose();
  }
}
