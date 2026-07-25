# Changelog

## 0.3.2

- Detect existing Claude Code and Codex profiles in `~/.quarryfi/config.json`.
- Let users review profile names, masked keys, and workspace scopes before importing.
- Copy selected keys into encrypted VS Code SecretStorage without displaying or logging plaintext.
- Keep manual setup available for new, remote, or separately configured environments.

## 0.3.1

- Correct the alternate VSIX installation guidance to point to the Marketplace-distributed package.

## 0.3.0

- Enable first-class VS Code heartbeat tracking against the current QuarryFi API.
- Store API keys in encrypted VS Code SecretStorage and migrate 0.2.x plaintext settings.
- Default-deny workspace routing, pin the production API endpoint, and add key verification.
- Report extension runtime health, bound offline queues, and expose status diagnostics.
- Add a 30-day local audit retention policy and a clear-log command.
- Add unit, extension-host, CI, and Marketplace packaging support.

## 0.2.0

- Added multi-company profile routing and basic local audit logging.
