import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadCopilotInstructions } from "./shared/copilot-instructions.ts";

export const COPILOT_INSTRUCTION_PATHS = [
  "copilot-instructions.md",
  ".copilot-instructions.md",
  ".github/copilot-instructions.md",
] as const;

export const COPILOT_SKILL_PATHS = [".github/skills", ".claude/skills"] as const;

export function isSkillsDisabled(argv: string[] = process.argv): boolean {
  return argv.includes("--no-skills") || argv.includes("-ns");
}

function repositoryRoot(cwd: string): string {
  let directory = path.resolve(cwd);
  while (true) {
    if (fs.existsSync(path.join(directory, ".git"))) return directory;
    const parent = path.dirname(directory);
    if (parent === directory) return path.resolve(cwd);
    directory = parent;
  }
}

export default function (pi: ExtensionAPI) {
  pi.on("resources_discover", (event) => {
    if (isSkillsDisabled()) return { skillPaths: [] };

    const root = repositoryRoot(event.cwd);
    const skillPaths = COPILOT_SKILL_PATHS.flatMap((relativePath) => {
      const skillsPath = path.join(root, relativePath);
      try {
        return fs.statSync(skillsPath).isDirectory() ? [skillsPath] : [];
      } catch {
        // Copilot skills are optional.
        return [];
      }
    });
    return { skillPaths };
  });

  pi.on("before_agent_start", async (event, ctx) => {
    const agentDir =
      process.env.PI_CODING_AGENT_DIR ??
      path.join(os.homedir(), ".pi", "agent");
    const instructions = loadCopilotInstructions(
      ctx.cwd,
      agentDir,
      COPILOT_INSTRUCTION_PATHS,
    );
    if (instructions) {
      event.systemPromptOptions.sections["copilot_instructions"] = instructions;
    }
    return undefined;
  });
}
