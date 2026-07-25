export interface StoredProfile {
  id: string;
  name: string;
  workspaceFolders: string[];
  matchAll: boolean;
}

export interface Profile extends StoredProfile {
  apiKey: string;
}

export interface Heartbeat {
  source: "vscode";
  project_name: string;
  language: string;
  file_type: string;
  branch: string;
  editor: string;
  timestamp: string;
  duration_seconds: number;
  session_id: string;
}

export interface ClientMetadata {
  plugin_version: string;
  runtime_channel: string;
  hook_mode: "editor_activity_30s";
  install_revision: string;
  host_app: "vscode";
}
