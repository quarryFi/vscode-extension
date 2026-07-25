import assert from "node:assert/strict";
import * as vscode from "vscode";

export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension("quarryfi.quarryfi-tracker");
  assert.ok(extension, "Development extension was not discovered.");
  await extension.activate();
  assert.equal(extension.isActive, true);

  const commands = await vscode.commands.getCommands(true);
  for (const command of [
    "quarryfi.configure",
    "quarryfi.showStatus",
    "quarryfi.toggleTracking",
    "quarryfi.clearAuditLog",
  ]) {
    assert.ok(commands.includes(command), `Missing command: ${command}`);
  }
}
