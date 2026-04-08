# quarryFi VS Code Extension

quarryFi time tracking extension for VS Code, Cursor, and Windsurf. Tracks R&D activity for automated tax credit documentation.

## Install

Search for **quarryFi** in the VS Code extension marketplace, or install from the command line:

```bash
code --install-extension quarryfi.quarryfi-tracker
```

## Configuration

Open VS Code settings and set:

- `quarryfi.apiKey` — Your QuarryFi API key (get one from your [dashboard](https://quarryfi.smashedstudiosllc.workers.dev/dashboard))
- `quarryfi.apiUrl` — API endpoint (default: `https://quarryfi.smashedstudiosllc.workers.dev`)

## What it tracks

- Active editing time per file
- Project and workspace context
- Language and file types
- Branch information
- Idle detection (pauses tracking after 5 minutes of inactivity)

All data is sent to your QuarryFi account for R&D tax credit qualification analysis.
