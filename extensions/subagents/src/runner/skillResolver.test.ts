import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveSkillPaths } from "./skillResolver.ts";

const skillFile = (name: string) => `---
name: ${name}
description: Skill ${name}
---
Skill content for ${name}.
`;

describe("resolveSkillPaths", () => {
  let tmpAgentDir: string;
  let tmpCwd: string;
  let originalAgentDir: string | undefined;

  beforeEach(() => {
    tmpAgentDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "skill-resolver-agent-"),
    );
    tmpCwd = fs.mkdtempSync(path.join(os.tmpdir(), "skill-resolver-cwd-"));
    originalAgentDir = process.env.PI_CODING_AGENT_DIR;
    process.env.PI_CODING_AGENT_DIR = tmpAgentDir;
  });

  afterEach(() => {
    if (originalAgentDir === undefined) {
      delete process.env.PI_CODING_AGENT_DIR;
    } else {
      process.env.PI_CODING_AGENT_DIR = originalAgentDir;
    }
    fs.rmSync(tmpAgentDir, { recursive: true, force: true });
    fs.rmSync(tmpCwd, { recursive: true, force: true });
  });

  it("resolves user skills by name", async () => {
    const skillsDir = path.join(tmpAgentDir, "skills", "tdd");
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillsDir, "SKILL.md"),
      skillFile("tdd"),
      "utf-8",
    );

    const result = await resolveSkillPaths(["tdd"], {
      cwd: tmpCwd,
      agentDir: tmpAgentDir,
      projectTrusted: true,
    });

    expect(result.paths).toHaveLength(1);
    expect(result.paths[0]).toBe(path.join(skillsDir, "SKILL.md"));
    expect(result.missing).toEqual([]);
  });

  it("resolves project skills by name", async () => {
    const skillsDir = path.join(tmpCwd, ".pi", "skills", "refactor");
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillsDir, "SKILL.md"),
      skillFile("refactor"),
      "utf-8",
    );

    const result = await resolveSkillPaths(["refactor"], {
      cwd: tmpCwd,
      agentDir: tmpAgentDir,
      projectTrusted: true,
    });

    expect(result.paths).toHaveLength(1);
    expect(result.missing).toEqual([]);
  });

  it("returns unknown skills in missing", async () => {
    const result = await resolveSkillPaths(["unknown-skill"], {
      cwd: tmpCwd,
      agentDir: tmpAgentDir,
      projectTrusted: true,
    });

    expect(result.paths).toEqual([]);
    expect(result.missing).toEqual(["unknown-skill"]);
  });

  it("resolves multiple skills", async () => {
    const userDir = path.join(tmpAgentDir, "skills", "tdd");
    const projectDir = path.join(tmpCwd, ".pi", "skills", "refactor");
    fs.mkdirSync(userDir, { recursive: true });
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(userDir, "SKILL.md"), skillFile("tdd"), "utf-8");
    fs.writeFileSync(
      path.join(projectDir, "SKILL.md"),
      skillFile("refactor"),
      "utf-8",
    );

    const result = await resolveSkillPaths(["tdd", "refactor"], {
      cwd: tmpCwd,
      agentDir: tmpAgentDir,
      projectTrusted: true,
    });

    expect(result.paths).toHaveLength(2);
    expect(result.missing).toEqual([]);
  });
});
