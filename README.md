# QuarryFi R&D Tracker

VS Code extension that tracks active coding time and sends heartbeats to the QuarryFi API for automated R&D tax credit documentation. Also works in **Cursor** and **Windsurf**.

## What it does

- Tracks active editing time (typing, switching files, saving)
- Sends heartbeats every 30 seconds during active coding
- Detects project name, language, file type, and git branch
- Batches heartbeats and posts them to the QuarryFi API
- Status bar shows tracking state with click-to-toggle

## Install from VSIX

1. Download the `.vsix` file from the [releases page](https://github.com/smashedstudiosllc/vscode-extension/releases)
2. In VS Code: **Extensions** sidebar > **...** menu > **Install from VSIX...**
3. Select the downloaded file

Or from the command line:

```bash
code --install-extension quarryfi-tracker-0.1.0.vsix
```

Marketplace publishing is coming soon.

## Setup

1. Sign in to your [QuarryFi dashboard](https://quarryfi.smashedstudiosllc.workers.dev/dashboard)
2. Generate an API key (starts with `qf_`)
3. In VS Code, run **QuarryFi: Set API Key** from the command palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and paste your key

Or set it directly in settings:

```json
{
  "quarryfi.apiKey": "qf_your_key_here",
  "quarryfi.apiUrl": "https://quarryfi.smashedstudiosllc.workers.dev"
}
```

## Commands

| Command | Description |
|---|---|
| `QuarryFi: Set API Key` | Prompt to enter your API key |
| `QuarryFi: Toggle Tracking` | Pause or resume tracking |

## Privacy

This extension **only sends metadata** to the QuarryFi API:

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
