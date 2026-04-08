import * as vscode from 'vscode';

export class StatusBar {
  private item: vscode.StatusBarItem;
  private _tracking = true;
  private _activeProfileName: string | null = null;

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

  setActiveProfile(name: string | null): void {
    this._activeProfileName = name;
    this.update();
  }

  private update(): void {
    if (!this._tracking) {
      this.item.text = '$(debug-pause) quarryFi: paused';
      this.item.color = new vscode.ThemeColor('disabledForeground');
      this.item.tooltip = 'QuarryFi tracking is paused. Click to resume.';
      return;
    }

    if (this._activeProfileName) {
      this.item.text = `$(pulse) quarryFi: ${this._activeProfileName}`;
      this.item.color = new vscode.ThemeColor('testing.iconPassed');
      this.item.tooltip = `Tracking for ${this._activeProfileName}. Click to pause.`;
    } else {
      this.item.text = '$(pulse) quarryFi: no match';
      this.item.color = new vscode.ThemeColor('editorWarning.foreground');
      this.item.tooltip = 'No matching profile for current file. Click to pause.';
    }
  }

  dispose(): void {
    this.item.dispose();
  }
}
