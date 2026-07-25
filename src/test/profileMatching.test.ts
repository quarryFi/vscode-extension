import assert from "node:assert/strict";
import test from "node:test";
import { API_KEY_PATTERN, EXTENSION_SOURCE } from "../constants";
import { pathMatchesFolder, resolveMatchingProfiles } from "../profileMatching";
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
