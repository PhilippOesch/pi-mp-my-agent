import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import registerInstructions, {
  COPILOT_SKILL_PATHS,
  isSkillsDisabled,
} from "../../../../instructions.ts";

function discoverSkills(cwd: string): string[] {
  const on = vi.fn();
  registerInstructions({ on } as unknown as ExtensionAPI);
  const handler = on.mock.calls.find(
    ([event]) => event === "resources_discover",
  )?.[1];
  expect(handler).toBeDefined();
  return handler({ type: "resources_discover", cwd, reason: "startup" })
    .skillPaths;
}

describe("Copilot skills discovery", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "copilot-skills-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns both repository skills directories from a nested cwd", () => {
    const root = path.join(tempDir, "repo");
    const nested = path.join(root, "src", "module");
    const skills = COPILOT_SKILL_PATHS.map((relativePath) =>
      path.join(root, relativePath),
    );
    fs.mkdirSync(path.join(root, ".git"), { recursive: true });
    fs.mkdirSync(nested, { recursive: true });
    for (const skillsPath of skills) {
      fs.mkdirSync(skillsPath, { recursive: true });
    }
    fs.mkdirSync(path.join(nested, ".github", "skills"), { recursive: true });
    fs.mkdirSync(path.join(nested, ".claude", "skills"), { recursive: true });

    expect(discoverSkills(nested)).toEqual(skills);
  });

  it("supports a worktree .git file", () => {
    const root = path.join(tempDir, "worktree");
    const skills = path.join(root, ".github", "skills");
    fs.mkdirSync(skills, { recursive: true });
    fs.writeFileSync(path.join(root, ".git"), "gitdir: /some/other/path");

    expect(discoverSkills(root)).toEqual([skills]);
  });

  it("returns only existing directories when a skill path is missing or not a directory", () => {
    const root = path.join(tempDir, "repo");
    const githubSkills = path.join(root, ".github", "skills");
    const claudeSkills = path.join(root, ".claude", "skills");
    fs.mkdirSync(path.join(root, ".git"), { recursive: true });

    expect(discoverSkills(root)).toEqual([]);
    fs.mkdirSync(githubSkills, { recursive: true });
    expect(discoverSkills(root)).toEqual([githubSkills]);
    fs.mkdirSync(claudeSkills, { recursive: true });
    fs.rmSync(githubSkills, { recursive: true });
    expect(discoverSkills(root)).toEqual([claudeSkills]);
    fs.mkdirSync(path.dirname(githubSkills), { recursive: true });
    fs.writeFileSync(githubSkills, "not a directory");
    expect(discoverSkills(root)).toEqual([claudeSkills]);
  });

  it("discovers skills in a non-git cwd", () => {
    const skills = path.join(tempDir, ".github", "skills");
    fs.mkdirSync(skills, { recursive: true });

    expect(discoverSkills(tempDir)).toEqual([skills]);
  });

  it("returns no skills when --no-skills is set", () => {
    const root = path.join(tempDir, "repo");
    fs.mkdirSync(path.join(root, ".git"), { recursive: true });
    for (const relativePath of COPILOT_SKILL_PATHS) {
      fs.mkdirSync(path.join(root, relativePath), { recursive: true });
    }

    const argvSpy = vi
      .spyOn(process, "argv", "get")
      .mockReturnValue(["pi", "--no-skills"]);
    expect(discoverSkills(root)).toEqual([]);
    argvSpy.mockRestore();
  });

  it("returns no skills when -ns is set", () => {
    const root = path.join(tempDir, "repo");
    fs.mkdirSync(path.join(root, ".git"), { recursive: true });
    for (const relativePath of COPILOT_SKILL_PATHS) {
      fs.mkdirSync(path.join(root, relativePath), { recursive: true });
    }

    const argvSpy = vi
      .spyOn(process, "argv", "get")
      .mockReturnValue(["pi", "-ns"]);
    expect(discoverSkills(root)).toEqual([]);
    argvSpy.mockRestore();
  });
});

describe("isSkillsDisabled", () => {
  it("detects --no-skills", () => {
    expect(isSkillsDisabled(["pi", "--no-skills"])).toBe(true);
  });

  it("detects -ns", () => {
    expect(isSkillsDisabled(["pi", "-ns"])).toBe(true);
  });

  it("returns false otherwise", () => {
    expect(isSkillsDisabled(["pi", "--model", "gpt-4o"])).toBe(false);
    expect(isSkillsDisabled(["pi"])).toBe(false);
  });
});
