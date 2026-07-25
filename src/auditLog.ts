import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type * as vscode from "vscode";
import { AUDIT_MAX_BYTES, AUDIT_RETENTION_DAYS } from "./constants";
import type { Heartbeat, Profile } from "./types";

const LOG_DIR = path.join(os.homedir(), ".quarryfi");
const LOG_FILE = path.join(LOG_DIR, "vscode-audit.log");
let pending = Promise.resolve();

export class AuditLog {
  constructor(private readonly output: vscode.OutputChannel) {}

  append(heartbeats: Heartbeat[], profile: Profile): void {
    pending = pending.then(() => this.write(heartbeats, profile));
  }

  async clear(): Promise<void> {
    await fs.promises.mkdir(LOG_DIR, { recursive: true, mode: 0o700 });
    await fs.promises.writeFile(LOG_FILE, "", { encoding: "utf8", mode: 0o600 });
  }

  async flush(): Promise<void> {
    await pending;
  }

  get path(): string {
    return LOG_FILE;
  }

  private async write(heartbeats: Heartbeat[], profile: Profile): Promise<void> {
    try {
      await fs.promises.mkdir(LOG_DIR, { recursive: true, mode: 0o700 });
      const sentAt = new Date().toISOString();
      const lines = heartbeats.map((heartbeat) =>
        JSON.stringify({
          ...heartbeat,
          profile: profile.name,
          delivery_status: "sent",
          sent_at: sentAt,
        })
      );
      await fs.promises.appendFile(LOG_FILE, lines.join("\n") + "\n", {
        encoding: "utf8",
        mode: 0o600,
      });
      await this.prune();
    } catch (error) {
      this.output.appendLine(`[QuarryFi Audit] ${errorMessage(error)}`);
    }
  }

  private async prune(): Promise<void> {
    const stat = await fs.promises.stat(LOG_FILE);
    const cutoff = Date.now() - AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    if (stat.size <= AUDIT_MAX_BYTES && stat.mtimeMs >= cutoff) return;

    const lines = (await fs.promises.readFile(LOG_FILE, "utf8")).split("\n").filter(Boolean);
    const retained = lines.filter((line) => {
      try {
        const record = JSON.parse(line) as { sent_at?: string; timestamp?: string };
        const timestamp = Date.parse(record.sent_at ?? record.timestamp ?? "");
        return Number.isFinite(timestamp) && timestamp >= cutoff;
      } catch {
        return false;
      }
    });

    while (Buffer.byteLength(retained.join("\n") + "\n", "utf8") > AUDIT_MAX_BYTES && retained.length > 0) {
      retained.shift();
    }
    await fs.promises.writeFile(LOG_FILE, retained.length > 0 ? retained.join("\n") + "\n" : "", {
      encoding: "utf8",
      mode: 0o600,
    });
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
