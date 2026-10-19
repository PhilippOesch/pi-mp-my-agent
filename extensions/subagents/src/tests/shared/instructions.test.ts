import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import registerInstructions from "../../../../instructions.ts";

function discoverSkills(cwd: string): string[] {
  const on = vi.fn();
  registerInstructions({ on } as unknown as ExtensionAPI);
  const handler = on.mock.calls.find(([event]) => event === "resources_discover")?.[1];
  expect(handler).toBeDefined();
  return handler({ type: "resources_discover", cwd, reason: "startup" }).skillPaths;
}

describe("Copilot skills discovery", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "copilot-skills-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns the repository skills directory from a nested cwd", () => {
    const root = path.join(tempDir, "repo");
    const nested = path.join(root, "src", "module");
    const skills = path.join(root, ".github", "skills");
    fs.mkdirSync(path.join(root, ".git"), { recursive: true });
    fs.mkdirSync(nested, { recursive: true });
    fs.mkdirSync(skills, { recursive: true });
    fs.mkdirSync(path.join(nested, ".github", "skills"), { recursive: true });

    expect(discoverSkills(nested)).toEqual([skills]);
  });

  it("supports a worktree .git file", () => {
    const root = path.join(tempDir, "worktree");
    const skills = path.join(root, ".github", "skills");
    fs.mkdirSync(skills, { recursive: true });
    fs.writeFileSync(path.join(root, ".git"), "gitdir: /some/other/path");

    expect(discoverSkills(root)).toEqual([skills]);
  });

  it("does not return a missing or non-directory skills path", () => {
    const root = path.join(tempDir, "repo");
    const skills = path.join(root, ".github", "skills");
    fs.mkdirSync(path.join(root, ".git"), { recursive: true });
    fs.mkdirSync(path.dirname(skills), { recursive: true });

    expect(discoverSkills(root)).toEqual([]);
    fs.writeFileSync(skills, "not a directory");
    expect(discoverSkills(root)).toEqual([]);
  });

  it("discovers skills in a non-git cwd", () => {
    const skills = path.join(tempDir, ".github", "skills");
    fs.mkdirSync(skills, { recursive: true });

    expect(discoverSkills(tempDir)).toEqual([skills]);
  });
});
