# Visual Studio Marketplace publishing

QuarryFi publishes through Microsoft Entra and GitHub Actions using workload identity federation. The release path does not store a Visual Studio Marketplace Personal Access Token or an Entra client secret.

## Authentication model

- Entra application: `QuarryFi VS Code Marketplace Publisher`
- Entra tenant: the QuarryFi-owned Microsoft tenant
- GitHub repository: `quarryFi/vscode-extension`
- GitHub environment: `vscode-marketplace`
- Federated subject: `repo:quarryFi@274402560/vscode-extension@1204520666:environment:vscode-marketplace`
- Federated issuer: `https://token.actions.githubusercontent.com`
- Federated audience: `api://AzureADTokenExchange`
- Marketplace publisher role: Contributor

The GitHub environment stores only `AZURE_CLIENT_ID` and `AZURE_TENANT_ID` variables. These are identifiers, not credentials. GitHub supplies a short-lived OIDC token for each approved workflow run. Microsoft Entra exchanges it for a short-lived access token scoped to the Marketplace service.

The app has no Azure subscription role because Marketplace publishing is a tenant-level operation and this tenant has no Azure subscription. `Azure/login` is deliberately configured with `allow-no-subscriptions: true`.

## Release flow

1. Update `package.json`, `package-lock.json`, and `CHANGELOG.md` to the same new version.
2. Run `npm ci`, `npm run check`, `npm run build`, `npm run test:integration`, and `npm run package` locally.
3. Commit and push the release changes.
4. Create and push an annotated `vX.Y.Z` tag matching `package.json`.
5. Approve the `vscode-marketplace` GitHub environment deployment.

The workflow then rebuilds from the tagged commit, reruns unit and integration tests, packages the VSIX, signs in through OIDC, confirms the Entra identity has Marketplace Contributor access, publishes the exact package, verifies the Marketplace version, retains the VSIX as a workflow artifact, and creates the matching GitHub release.

Manual runs are allowed only from `main`. `identity-profile` reports the identity's Marketplace profile ID during bootstrap, `verify-access` tests Contributor access without publishing, and `publish` publishes the version already declared in `package.json`. Marketplace duplicate-version protection still applies.

## One-time Microsoft configuration

1. Register the single-tenant Entra application named above.
2. Add a GitHub Actions federated credential using the environment subject above.
3. Authenticate as that service principal and request its Azure DevOps profile ID from:

   ```bash
   az rest \
     --method get \
     --url "https://app.vssps.visualstudio.com/_apis/profile/profiles/me" \
     --resource "499b84ac-1321-427f-aa17-267ca6975798"
   ```

4. In the Visual Studio Marketplace publisher portal, add that profile ID to the `quarryfi` publisher with the Contributor role.
5. Set `AZURE_CLIENT_ID` and `AZURE_TENANT_ID` as variables on the protected `vscode-marketplace` GitHub environment.
6. Run the workflow in `verify-access` mode to confirm the complete permission chain without publishing a release.

Do not add a PAT, client secret, certificate private key, or production QuarryFi credential to this repository or workflow.

## Recovery

If automated publishing is unavailable, `npm run package` still produces a reviewable VSIX for manual upload in the Marketplace publisher portal. Manual upload is the recovery path, not the routine release path.

If OIDC fails, verify the GitHub environment name, federated subject, tenant ID, client ID, and the service principal's Marketplace Contributor membership. Do not work around an identity error by introducing a long-lived PAT.
