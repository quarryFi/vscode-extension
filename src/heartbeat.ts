import { getApiKey, getApiUrl } from './config';

export interface Heartbeat {
  source: string;
  project_name: string;
  language: string;
  file_type: string;
  branch: string | null;
  editor: string;
  timestamp: string;
  duration_seconds: number;
}

const BATCH_FLUSH_SIZE = 10;

let batch: Heartbeat[] = [];
let flushTimer: ReturnType<typeof setTimeout> | undefined;

export function enqueue(heartbeat: Heartbeat): void {
  batch.push(heartbeat);

  if (batch.length >= BATCH_FLUSH_SIZE) {
    flush();
  } else if (!flushTimer) {
    flushTimer = setTimeout(flush, 60_000);
  }
}

export async function flush(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = undefined;
  }

  if (batch.length === 0) {
    return;
  }

  const toSend = batch.splice(0);
  const apiKey = getApiKey();
  const apiUrl = getApiUrl();

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
      // Put them back for retry on next flush
      batch.unshift(...toSend);
    }
  } catch {
    // Network error — put them back
    batch.unshift(...toSend);
  }
}

export function dispose(): void {
  flush();
}
