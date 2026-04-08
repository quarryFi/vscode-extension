# QuarryFi R&D Tracker

VS Code extension that tracks active coding time and sends heartbeats to the QuarryFi API for automated R&D tax credit documentation. Also works in **Cursor** and **Windsurf**.

## What it does

- Tracks active editing time (typing, switching files, saving)
- Sends heartbeats every 30 seconds during active coding
- Detects project name, language, file type, and git branch
- Routes heartbeats to the correct company profile based on workspace folder
- Batches heartbeats and posts them to the QuarryFi API
- Logs all sent heartbeats locally for audit transparency
- Status bar shows which profile is active for the current file

## Install from VSIX

1. Download the `.vsix` file from the [releases page](https://github.com/smashedstudiosllc/vscode-extension/releases)
2. In VS Code: **Extensions** sidebar > **...** menu > **Install from VSIX...**
3. Select the downloaded file

Or from the command line:

```bash
code --install-extension quarryfi-tracker-0.2.0.vsix
```

Marketplace publishing is coming soon.

## Setup

### Quick setup (single company)

Run **QuarryFi: Set API Key** from the command palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and paste your key. This tracks all workspaces under one API key.

### Multi-company setup

If you work for multiple companies (e.g., as a freelancer), configure profiles to route heartbeats from each workspace to the correct company's API key.

Run **QuarryFi: Configure Profiles** from the command palette for a guided setup, or edit `settings.json` directly:

```json
{
  "quarryfi.profiles": [
    {
      "name": "Acme Corp",
      "apiKey": "qf_acme_key_here",
      "apiUrl": "https://quarryfi.smashedstudiosllc.workers.dev",
      "workspaceFolders": ["/Users/me/work/acme-api", "/Users/me/work/acme-frontend"]
    },
    {
      "name": "Beta Inc",
      "apiKey": "qf_beta_key_here",
      "apiUrl": "https://quarryfi.smashedstudiosllc.workers.dev",
      "workspaceFolders": ["/Users/me/work/beta-app"]
    },
    {
      "name": "Personal R&D",
      "apiKey": "qf_personal_key_here",
      "workspaceFolders": []
    }
  ]
}
```

**How matching works:**

- Each profile lists absolute folder paths in `workspaceFolders`.
- When you edit a file, the extension checks which profile's folders are a prefix of the file path.
- If a file matches multiple profiles, heartbeats are sent to all of them.
- An empty `workspaceFolders` array (`[]`) is a catch-all that matches every file.
- If no profile matches the current file, no heartbeat is sent.

### Backward compatibility

The old single-key settings (`quarryfi.apiKey` and `quarryfi.apiUrl`) still work. If no profiles are configured, a single API key is treated as a catch-all profile that tracks all workspaces.

## Commands

| Command | Description |
|---|---|
| `QuarryFi: Configure Profiles` | Guided setup for multi-company profiles |
| `QuarryFi: Set API Key` | Set a single API key (legacy) |
| `QuarryFi: Toggle Tracking` | Pause or resume tracking |

## Status bar

The status bar shows which profile is active for the current file:

- **quarryFi: Acme Corp** (green) — tracking, matched to "Acme Corp" profile
- **quarryFi: no match** (amber) — tracking enabled but current file doesn't match any profile
- **quarryFi: paused** (gray) — tracking is paused

Click the status bar item to toggle tracking on/off.

## Audit log

All sent heartbeats are logged locally to `~/.quarryfi/audit.log` as one JSON object per line. This provides a transparent record of what data was sent and when.

- The log is capped at 1MB and automatically rotated (oldest entries are dropped).
- No configuration is needed — logging happens automatically.
- Errors are reported in the **QuarryFi** output channel (View > Output > QuarryFi).

## Privacy

This extension **only sends metadata** to the QuarryFi API:

- Profile name (which company the heartbeat is for)
- Project name (workspace folder name)
- Programming language
- File extension
- Git branch name
- Timestamps and duration

**It never sends file contents, file paths, or source code.**

## Development

```bash
npm install
npm run watch    # development with auto-rebuild
npm run build    # production build
npm run package  # create .vsix file
```

## License

MIT
