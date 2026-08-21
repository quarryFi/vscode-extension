# QuarryFi R&D Tracker for VS Code

Turn active development time into metadata-only R&D evidence in QuarryFi—without sending source code, file contents, or keystrokes.

## Install

Install **QuarryFi R&D Tracker** from the VS Code Marketplace, or run:

```bash
code --install-extension quarryfi.quarryfi-tracker
```

On first installation, VS Code asks you to confirm that you trust the third-party publisher **QuarryFi**. Review the publisher and extension identifier before continuing.

For a compatible VS Code-based editor, download the Marketplace VSIX, then choose **Extensions → … → Install from VSIX…**. Marketplace installs receive normal extension updates; VS Code disables automatic updates by default for extensions installed manually from a VSIX.

## Set up tracking

1. If Claude Code or Codex is already configured on this machine, accept **Review & import** after installation or run **QuarryFi: Import Existing Claude Code / Codex Profile**. Review the profile and workspace scope before importing it into encrypted VS Code storage.
2. Otherwise, review the [public QuarryFi VS Code setup guide](https://quarryfi.com/integrations#vscode), then have the QuarryFi account owner create a seat-assigned key from the Team dashboard. A key is shown only once, so copy it when it is created.
3. In VS Code, run **QuarryFi: Configure Tracking**, add a profile, paste the key, and select the workspace folders that belong to that QuarryFi account.
4. Start working. The status bar shows the matched profile and delivery state.

Tracker keys and accepted heartbeats require an active QuarryFi Core subscription. You can create and explore a Free account before upgrading, but Free accounts cannot generate new tracker keys.

Claude Code and Codex keep their shared profile configuration in `~/.quarryfi/config.json`. Import is always user-confirmed, never displays or logs the full key, and copies selected keys into VS Code `SecretStorage`. Manually entered keys are verified against the seat-scoped status endpoint before saving. API keys are never written to VS Code `settings.json`.

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
- Current Git commit SHA, a one-way hash of the GitHub `owner/repository` name, a changed-file count, and a coarse activity category used for evidence reconciliation
- Extension version and runtime diagnostics

It does **not** send source code, file contents, full file paths, raw repository URLs, keystrokes, Git diffs, commit messages, prompts, terminal contents, or environment variables.

Tracking is limited to trusted local or remote filesystem workspaces. If the active file does not match a profile, the extension sends nothing.

## Commands

| Command | Purpose |
|---|---|
| **QuarryFi: Configure Tracking** | Add, edit, or remove encrypted profiles |
| **QuarryFi: Import Existing Claude Code / Codex Profile** | Review and securely import profiles from `~/.quarryfi/config.json` |
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

## Upgrading from older releases

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
3. Commit the release and push an annotated `vX.Y.Z` tag that exactly matches `package.json`.
4. Approve the protected `vscode-marketplace` GitHub environment. The release workflow publishes the reviewed VSIX through Microsoft Entra workload identity federation and creates the matching GitHub release.

See [Marketplace publishing](docs/marketplace-publishing.md) for the identity model, one-time configuration, release gates, and recovery process. Manual VSIX upload remains available as a recovery path.

The routine release path stores no Marketplace PAT or Entra client secret. Publisher access belongs in Microsoft Entra and the Marketplace publisher account—not in this repository.

## License

MIT. See [LICENSE](LICENSE).
