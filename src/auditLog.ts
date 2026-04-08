import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type * as vscode from 'vscode';
import type { Heartbeat } from './heartbeat';
import type { Profile } from './config';

const LOG_DIR = path.join(os.homedir(), '.quarryfi');
const LOG_FILE = path.join(LOG_DIR, 'audit.log');
const MAX_SIZE = 1_048_576; // 1MB

let outputChannel: vscode.OutputChannel | undefined;
let pending = Promise.resolve();

export function init(channel: vscode.OutputChannel): void {
  outputChannel = channel;
}

export function append(heartbeats: Heartbeat[], profile: Profile): void {
  pending = pending.then(() => doAppend(heartbeats, profile));
}

async function doAppend(heartbeats: Heartbeat[], profile: Profile): Promise<void> {
  try {
    await fs.promises.mkdir(LOG_DIR, { recursive: true });

    const lines = heartbeats.map((hb) =>
      JSON.stringify({
        ...hb,
        profile: profile.name,
        sentAt: new Date().toISOString(),
      })
    );

    await fs.promises.appendFile(LOG_FILE, lines.join('\n') + '\n', 'utf-8');

    await rotate();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    outputChannel?.appendLine(`[QuarryFi Audit] Error: ${message}`);
  }
}

async function rotate(): Promise<void> {
  try {
    const stat = await fs.promises.stat(LOG_FILE);
    if (stat.size <= MAX_SIZE) {
      return;
    }

    const content = await fs.promises.readFile(LOG_FILE, 'utf-8');
    const allLines = content.split('\n').filter((l) => l.length > 0);
    const half = Math.floor(allLines.length / 2);
    const kept = allLines.slice(half);
    await fs.promises.writeFile(LOG_FILE, kept.join('\n') + '\n', 'utf-8');

    outputChannel?.appendLine(
      `[QuarryFi Audit] Rotated log: dropped ${half} old entries, kept ${kept.length}.`
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    outputChannel?.appendLine(`[QuarryFi Audit] Rotation error: ${message}`);
  }
}
