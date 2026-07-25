# QuarryFi R&D Tracker for VS Code

Turn active development time into metadata-only R&D evidence in QuarryFi—without sending source code, file contents, or keystrokes.

## Install

Install **QuarryFi R&D Tracker** from the VS Code Marketplace, or run:

```bash
code --install-extension quarryfi.quarryfi-tracker
```

For a private pilot or a compatible VS Code-based editor, download the signed `.vsix` from the [GitHub releases page](https://github.com/quarryFi/vscode-extension/releases) and choose **Extensions → … → Install from VSIX…**.

## Set up tracking

1. In the [QuarryFi Team dashboard](https://quarryfi.com/dashboard/team), create or copy the API key assigned to your team member.
2. In VS Code, open the Command Palette and run **QuarryFi: Configure Tracking**.
3. Add a profile, paste the key, and select the workspace folders that belong to that QuarryFi account.
4. Start working. The status bar shows the matched profile and delivery state.

QuarryFi verifies the key against the seat-scoped status endpoint before saving it. API keys are encrypted with VS Code `SecretStorage` and are never written to `settings.json`.

### Multiple companies

Create one profile per QuarryFi account. Each profile has its own encrypted key and an explicit set of workspace folders. A file can match more than one profile, but no unselected workspace sends metadata.

**Track all workspaces** is an explicit catch-all option. Use it only when every VS Code project belongs to the same QuarryFi account.

## What is tracked

During active editing, the extension sends a heartbeat about every 30 seconds containing:

- Workspace name
- VS Code language identifier and file extension
- Git branch
- Editor name
- Timestamp, active duration, and a random session ID
- Extension version and runtime diagnostics

It does **not** send source code, file contents, full file paths, keystrokes, Git diffs, commit messages, terminal contents, or environment variables.

Tracking is limited to trusted local or remote filesystem workspaces. If the active file does not match a profile, the extension sends nothing.

## Commands

| Command | Purpose |
|---|---|
| **QuarryFi: Configure Tracking** | Add, edit, or remove encrypted profiles |
| **QuarryFi: Show Tracking Status** | See the active profile, queue, and delivery health |
| **QuarryFi: Pause or Resume Tracking** | Persistently pause or resume collection |
| **QuarryFi: Clear Local Audit Log** | Delete the extension's local delivery log |

## Local audit log and retention

Successful deliveries are recorded in `~/.quarryfi/vscode-audit.log`. The log contains the same metadata sent to QuarryFi plus the local profile name and delivery time.

- Retention: 30 days
- Size cap: 1 MB
- Delete mechanism: **QuarryFi: Clear Local Audit Log**
- File mode: private to the local user where the operating system supports Unix permissions

API keys, source code, file contents, and full file paths are never logged.

## Upgrading from 0.2.x

On first activation, the extension migrates valid keys from the old plaintext `quarryfi.apiKey` and `quarryfi.profiles` settings into encrypted SecretStorage, preserves their workspace routing, and removes the plaintext settings. Custom API endpoints are intentionally not migrated; released builds send only to QuarryFi's production HTTPS endpoint.

## Troubleshooting

- **QuarryFi: no match** — Run **Configure Tracking** and assign the active workspace to a profile.
- **Warning icon / delivery rejected** — Run **Show Tracking Status**, then open **View → Output → QuarryFi**. A rejected key may not be assigned to an active team member or may not have Core access.
- **No heartbeat yet** — Make an edit in a matched workspace and allow up to one minute.
- **Need to inspect local records** — Run **Show Tracking Status → View audit log**.

Support: [open a GitHub issue](https://github.com/quarryFi/vscode-extension/issues) or see [SUPPORT.md](SUPPORT.md).

## Development

```bash
npm ci
npm run check
npm run build
npm run test:integration
npm run package
```

Integration tests use the official VS Code `@vscode/test-electron` tooling. Packaging uses `@vscode/vsce`.

## Publishing

1. Update `version` and `CHANGELOG.md`.
2. Run `npm ci && npm run check && npm run test:integration && npm run package`.
3. Upload the generated VSIX in the [Visual Studio Marketplace publisher portal](https://marketplace.visualstudio.com/manage/publishers/) or run `npm run publish:marketplace` with approved publisher credentials.
4. Create a matching GitHub release and attach the VSIX.

Publisher credentials belong in the Marketplace, Microsoft Entra, or a protected CI secret—not in this repository.

## License

MIT. See [LICENSE](LICENSE).
