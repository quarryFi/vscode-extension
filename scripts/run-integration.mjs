import path from "node:path";
import { fileURLToPath } from "node:url";
import { runTests } from "@vscode/test-electron";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

try {
  await runTests({
    extensionDevelopmentPath: root,
    extensionTestsPath: path.join(root, "dist-test", "runIntegration.js"),
    launchArgs: ["--disable-extensions"],
  });
} catch (error) {
  console.error("VS Code extension-host test failed:", error);
  process.exitCode = 1;
}
