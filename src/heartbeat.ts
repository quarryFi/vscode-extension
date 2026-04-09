import type * as vscode from 'vscode';
import { profileId, type Profile } from './config';
import { append as auditAppend } from './auditLog';

export interface Heartbeat {
  source: string;
  project_name: string;
  language: string;
  file_type: string;
  branch: string;
  editor: string;
  timestamp: string;
  duration_seconds: number;
  session_id: string;
}

interface ProfileBatch {
  profile: Profile;
  items: Heartbeat[];
}

const batches = new Map<string, ProfileBatch>();
let flushTimer: ReturnType<typeof setInterval> | undefined;
let outputChannel: vscode.OutputChannel | undefined;

const BATCH_FLUSH_SIZE = 10;
const FLUSH_INTERVAL_MS = 60_000;

export function init(channel: vscode.OutputChannel): void {
  outputChannel = channel;
  flushTimer = setInterval(() => { flush(); }, FLUSH_INTERVAL_MS);
}

export function enqueue(heartbeat: Heartbeat, profile: Profile): void {
  const id = profileId(profile);
  let entry = batches.get(id);
  if (!entry) {
    entry = { profile, items: [] };
    batches.set(id, entry);
  }
  entry.items.push(heartbeat);

  if (entry.items.length >= BATCH_FLUSH_SIZE) {
    flushProfile(id, entry);
  }
}

export async function flush(): Promise<void> {
  const promises: Promise<void>[] = [];
  for (const [id, entry] of batches) {
    if (entry.items.length > 0) {
      promises.push(flushProfile(id, entry));
    }
  }
  await Promise.all(promises);
}

async function flushProfile(id: string, entry: ProfileBatch): Promise<void> {
  const toSend = entry.items.splice(0);
  if (toSend.length === 0) {
    return;
  }

  const { apiKey, apiUrl } = entry.profile;
  if (!apiKey) {
    return;
  }

  try {
    const response = await fetch(`${apiUrl}/api/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ heartbeats: toSend }),
    });

    if (!response.ok) {
      entry.items.unshift(...toSend);
      outputChannel?.appendLine(
        `[QuarryFi] API error for "${entry.profile.name}": ${response.status} ${response.statusText}`
      );
    } else {
      auditAppend(toSend, entry.profile);
    }
  } catch (err: unknown) {
    entry.items.unshift(...toSend);
    const message = err instanceof Error ? err.message : String(err);
    outputChannel?.appendLine(`[QuarryFi] Network error for "${entry.profile.name}": ${message}`);
  }
}

export function dispose(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = undefined;
  }
  flush();
}
