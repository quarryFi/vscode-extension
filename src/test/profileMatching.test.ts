import assert from "node:assert/strict";
import test from "node:test";
import { API_KEY_PATTERN, EXTENSION_SOURCE } from "../constants";
import { pathMatchesFolder, resolveMatchingProfiles } from "../profileMatching";
import { maskApiKey, parseSharedConfig } from "../sharedConfig";
import { parseClientUpdate } from "../clientUpdate";
import type { Profile } from "../types";

const profiles: Profile[] = [
  {
    id: "acme",
    name: "Acme",
    apiKey: "qf_" + "a".repeat(40),
    workspaceFolders: ["/Users/dev/acme"],
    matchAll: false,
  },
  {
    id: "all",
    name: "All",
    apiKey: "qf_" + "b".repeat(40),
    workspaceFolders: [],
    matchAll: true,
  },
];

test("only the canonical VS Code source is emitted", () => {
  assert.equal(EXTENSION_SOURCE, "vscode");
});

test("heartbeat update notices are parsed without trusting malformed responses", () => {
  assert.equal(parseClientUpdate({ clientUpdates: [] }), null);
  assert.equal(parseClientUpdate({ clientUpdates: [{ source: "vscode", updateAvailable: true }] }), null);
  assert.deepEqual(parseClientUpdate({ clientUpdates: [{
    source: "vscode",
    currentVersion: "0.3.2",
    minimumVersion: "0.4.0",
    latestVersion: "0.4.1",
    updateUrl: "https://marketplace.visualstudio.com/items?itemName=quarryfi.quarryfi-tracker",
    updateAvailable: true,
    updateRequired: true,
  }] }), {
    source: "vscode",
    currentVersion: "0.3.2",
    minimumVersion: "0.4.0",
    latestVersion: "0.4.1",
    updateUrl: "https://marketplace.visualstudio.com/items?itemName=quarryfi.quarryfi-tracker",
    updateAvailable: true,
    updateRequired: true,
  });
});

test("API keys require the complete QuarryFi format", () => {
  assert.equal(API_KEY_PATTERN.test("qf_" + "a".repeat(40)), true);
  assert.equal(API_KEY_PATTERN.test("qf_short"), false);
  assert.equal(API_KEY_PATTERN.test("qf_" + "G".repeat(40)), false);
});

test("workspace matching respects path boundaries", () => {
  assert.equal(pathMatchesFolder("/Users/dev/acme/src/app.ts", "/Users/dev/acme", "darwin"), true);
  assert.equal(pathMatchesFolder("/Users/dev/acme-other/app.ts", "/Users/dev/acme", "darwin"), false);
});

test("Windows workspace matching is separator- and case-aware", () => {
  assert.equal(pathMatchesFolder("C:\\Work\\Acme\\src\\app.ts", "c:\\work\\acme", "win32"), true);
  assert.equal(pathMatchesFolder("C:\\Work\\Acme-Old\\app.ts", "c:\\work\\acme", "win32"), false);
});

test("no active file only matches an explicitly configured catch-all", () => {
  assert.deepEqual(resolveMatchingProfiles(profiles, null).map((profile) => profile.id), ["all"]);
});

test("matching returns the folder profile and explicit catch-all", () => {
  assert.deepEqual(
    resolveMatchingProfiles(profiles, "/Users/dev/acme/src/app.ts", "darwin").map((profile) => profile.id),
    ["acme", "all"]
  );
});

test("shared config imports valid profiles without exposing keys in labels", () => {
  const apiKey = "qf_" + "c".repeat(40);
  const imported = parseSharedConfig(JSON.stringify({
    profiles: [
      { name: "Acme", api_key: apiKey, projects: ["/Users/dev/acme", "/Users/dev/acme"] },
      { name: "Invalid", api_key: "qf_short", projects: [] },
    ],
  }));

  assert.deepEqual(imported, [{
    name: "Acme",
    apiKey,
    workspaceFolders: ["/Users/dev/acme"],
    matchAll: false,
  }]);
  assert.equal(maskApiKey(apiKey), "qf_...cccc");
});

test("legacy shared config imports as an explicit catch-all", () => {
  const apiKey = "qf_" + "d".repeat(40);
  assert.deepEqual(parseSharedConfig(JSON.stringify({ api_key: apiKey })), [{
    name: "Imported QuarryFi profile",
    apiKey,
    workspaceFolders: [],
    matchAll: true,
  }]);
});

test("malformed shared config imports nothing", () => {
  assert.deepEqual(parseSharedConfig("not-json"), []);
});
