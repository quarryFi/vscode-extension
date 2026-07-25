export const API_BASE_URL = "https://quarryfi.com";
export const DASHBOARD_URL = `${API_BASE_URL}/dashboard`;

export const HEARTBEAT_INTERVAL_MS = 30_000;
export const SESSION_GAP_MS = 5 * 60_000;
export const REQUEST_TIMEOUT_MS = 10_000;
export const MAX_BATCH_SIZE = 25;
export const MAX_QUEUED_HEARTBEATS = 100;

export const AUDIT_RETENTION_DAYS = 30;
export const AUDIT_MAX_BYTES = 1_048_576;

export const API_KEY_PATTERN = /^qf_[a-f0-9]{40}$/;
export const EXTENSION_SOURCE = "vscode";
