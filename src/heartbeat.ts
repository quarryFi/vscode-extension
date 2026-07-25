import type * as vscode from "vscode";
import {
  API_BASE_URL,
  MAX_BATCH_SIZE,
  MAX_QUEUED_HEARTBEATS,
  REQUEST_TIMEOUT_MS,
} from "./constants";
import type { AuditLog } from "./auditLog";
import type { ClientMetadata, Heartbeat, Profile } from "./types";

interface ProfileQueue {
  profile: Profile;
  items: Heartbeat[];
}

export type DeliveryState = "idle" | "sending" | "healthy" | "error";

export class HeartbeatClient implements vscode.Disposable {
  private readonly queues = new Map<string, ProfileQueue>();
  private readonly inFlight = new Map<string, Promise<void>>();
  private readonly stateEmitter: vscode.EventEmitter<DeliveryState>;
  readonly onDidChangeState: vscode.Event<DeliveryState>;
  private state: DeliveryState = "idle";

  constructor(
    private readonly output: vscode.OutputChannel,
    private readonly auditLog: AuditLog,
    private readonly client: ClientMetadata
  ) {
    const vscodeApi = require("vscode") as typeof vscode;
    this.stateEmitter = new vscodeApi.EventEmitter<DeliveryState>();
    this.onDidChangeState = this.stateEmitter.event;
  }

  enqueue(heartbeat: Heartbeat, profile: Profile): void {
    const entry = this.queues.get(profile.id) ?? { profile, items: [] };
    entry.profile = profile;
    entry.items.push(heartbeat);

    if (entry.items.length > MAX_QUEUED_HEARTBEATS) {
      const dropped = entry.items.length - MAX_QUEUED_HEARTBEATS;
      entry.items.splice(0, dropped);
      this.output.appendLine(
        `[QuarryFi] Queue full for "${profile.name}"; dropped ${dropped} oldest heartbeat${dropped === 1 ? "" : "s"}.`
      );
    }

    this.queues.set(profile.id, entry);
    if (entry.items.length >= MAX_BATCH_SIZE) void this.flushProfile(profile.id);
  }

  async flush(): Promise<void> {
    await Promise.all([...this.queues.keys()].map((id) => this.flushProfile(id)));
  }

  get pendingCount(): number {
    return [...this.queues.values()].reduce((total, queue) => total + queue.items.length, 0);
  }

  get deliveryState(): DeliveryState {
    return this.state;
  }

  dispose(): void {
    this.stateEmitter.dispose();
  }

  private async flushProfile(id: string): Promise<void> {
    const existing = this.inFlight.get(id);
    if (existing) return existing;

    const task = this.sendBatch(id).finally(() => {
      this.inFlight.delete(id);
    });
    this.inFlight.set(id, task);
    return task;
  }

  private async sendBatch(id: string): Promise<void> {
    const entry = this.queues.get(id);
    if (!entry || entry.items.length === 0) return;

    const batch = entry.items.slice(0, MAX_BATCH_SIZE);
    this.setState("sending");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${API_BASE_URL}/api/heartbeat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${entry.profile.apiKey}`,
        },
        body: JSON.stringify({ client: this.client, heartbeats: batch }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const message = await safeErrorMessage(response);
        this.output.appendLine(
          `[QuarryFi] Delivery rejected for "${entry.profile.name}" (HTTP ${response.status}): ${message}`
        );
        if (response.status === 400) entry.items.splice(0, batch.length);
        this.setState("error");
        return;
      }

      entry.items.splice(0, batch.length);
      this.auditLog.append(batch, entry.profile);
      this.output.appendLine(
        `[QuarryFi] Sent ${batch.length} heartbeat${batch.length === 1 ? "" : "s"} for "${entry.profile.name}".`
      );
      this.setState("healthy");

      if (entry.items.length > 0) await this.sendBatch(id);
    } catch (error) {
      const message = error instanceof Error && error.name === "AbortError"
        ? "request timed out"
        : errorMessage(error);
      this.output.appendLine(`[QuarryFi] Delivery failed for "${entry.profile.name}": ${message}`);
      this.setState("error");
    } finally {
      clearTimeout(timeout);
    }
  }

  private setState(state: DeliveryState): void {
    if (state === this.state) return;
    this.state = state;
    this.stateEmitter.fire(state);
  }
}

async function safeErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json() as { error?: unknown };
    return typeof body.error === "string" ? body.error.slice(0, 240) : response.statusText;
  } catch {
    return response.statusText;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
