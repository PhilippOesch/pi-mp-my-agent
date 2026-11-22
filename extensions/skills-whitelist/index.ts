/**
 * Skills whitelist extension for pi-mp-my-agent
 *
 * Filters package skills based on the skills.whitelist configuration.
 * Non-whitelisted package skills are removed from the system prompt and
 * blocked from /skill:<name> invocation.
 */

import type {
    ExtensionAPI,
    ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { fileURLToPath } from "node:url";
import * as path from "node:path";
import * as fs from "node:fs";
import type { Skill } from "@earendil-works/pi-coding-agent";
import { loadConfig } from "../shared/config.ts";

/**
 * Canonicalize a path by resolving symlinks.
 * Falls back to path.resolve if realpathSync fails.
 */
function canonicalPath(filePath: string): string {
    try {
        return fs.realpathSync(filePath);
    } catch {
        return path.resolve(filePath);
    }
}

/**
 * Get the canonical path to this package's skills directory.
 * Works in both local development (-e) and installed-from-git layouts.
 * Uses realpathSync to resolve symlinks, matching Pi's canonicalizePath behavior.
 */
function getPackageSkillsDir(): string {
    const thisFile = fileURLToPath(import.meta.url);
    // From extensions/skills-whitelist/index.ts, go up to repo root, then to skills/
    const skillsDir = path.resolve(
        path.dirname(thisFile),
        "..",
        "..",
        "skills",
    );
    return canonicalPath(skillsDir);
}

/**
 * Check if a skill belongs to this package.
 * Package skills have sourceInfo.origin === "package" AND their filePath is under
 * this package's skills/ directory.
 */
export function isThisPackageSkill(
    skill: Skill,
    packageSkillsDir: string,
): boolean {
    // First check: must be a package skill
    if (skill.sourceInfo.origin !== "package") {
        return false;
    }

    // Second check: filePath must be under this package's skills directory
    // Canonicalize both paths to handle symlinks (e.g., ~/.pi -> dotfiles/home/pi/)
    const skillDir = path.dirname(canonicalPath(skill.filePath));

    return (
        skillDir === packageSkillsDir ||
        skillDir.startsWith(packageSkillsDir + path.sep)
    );
}

/**
 * Filter package skills based on whitelist.
 * Returns kept skills and unknown whitelist entries.
 */
export function filterPackageSkills(
    skills: Skill[],
    whitelist: string[],
    packageSkillsDir: string,
): { kept: Skill[]; unknownEntries: string[] } {
    const kept: Skill[] = [];
    const unknownEntries: string[] = [];

    // If whitelist is empty, keep all skills
    if (whitelist.length === 0) {
        return { kept: [...skills], unknownEntries: [] };
    }

    const whitelistSet = new Set(whitelist);
    const matchedEntries = new Set<string>();

    for (const skill of skills) {
        if (isThisPackageSkill(skill, packageSkillsDir)) {
            if (whitelistSet.has(skill.name)) {
                kept.push(skill);
                matchedEntries.add(skill.name);
            }
            // Non-whitelisted package skills are filtered out (not added to kept)
        } else {
            kept.push(skill);
        }
    }

    for (const entry of whitelist) {
        if (!matchedEntries.has(entry)) {
            unknownEntries.push(entry);
        }
    }

    return { kept, unknownEntries };
}

/**
 * Shared state for the extension handlers.
 */
interface ExtensionState {
    packageSkillsDir: string;
    whitelist: string[];
    removedSkillNames: Set<string>;
    hasWarnedUnknown: boolean;
}

function createExtensionState(packageSkillsDir: string): ExtensionState {
    return {
        packageSkillsDir,
        whitelist: [],
        removedSkillNames: new Set(),
        hasWarnedUnknown: false,
    };
}

export default function (pi: ExtensionAPI) {
    const packageSkillsDir = getPackageSkillsDir();
    const state = createExtensionState(packageSkillsDir);

    // Load config at session start
    pi.on("session_start", async () => {
        const config = await loadConfig();
        state.whitelist = config.skills.whitelist;
        state.removedSkillNames = new Set();
        state.hasWarnedUnknown = false;
    });

    // Register before_agent_start handler to filter system prompt skills
    // and compute removed skill names
    pi.on("before_agent_start", (event) => {
        // If whitelist is empty, no filtering needed
        if (state.whitelist.length === 0) {
            return;
        }

        const packageSkillNames: string[] = [];

        const filteredSkills = event.systemPromptOptions.skills.filter(
            (skill: Skill) => {
                if (isThisPackageSkill(skill, state.packageSkillsDir)) {
                    packageSkillNames.push(skill.name);
                    // Keep package skills that are in the whitelist
                    if (state.whitelist.includes(skill.name)) {
                        return true;
                    }
                    // Remove package skills not in the whitelist
                    state.removedSkillNames.add(skill.name);
                    return false;
                }
                // Keep non-package skills and package skills from other packages
                return true;
            },
        );

        // Warn about unknown whitelist entries (only once per session)
        if (!state.hasWarnedUnknown) {
            state.hasWarnedUnknown = true;
            const unknownEntries = state.whitelist.filter(
                (entry) => !packageSkillNames.includes(entry),
            );

            if (unknownEntries.length > 0) {
                console.warn(
                    `[skills-whitelist] Unknown whitelist entries: ${unknownEntries.join(", ")}. ` +
                        `These skill names do not match any package skill from this package. ` +
                        `Available package skills: ${packageSkillNames.join(", ") || "none"}`,
                );
            }
        }

        event.systemPromptOptions.skills = filteredSkills;
    });

    // Register input handler to block /skill:<name> for removed skills
    pi.on("input", (event, ctx: ExtensionContext) => {
        const text = event.text;
        // Check for /skill:<name> pattern - supports hyphenated skill names
        const skillMatch = text.match(/^\/skill:([a-z0-9-]+)/);
        if (skillMatch) {
            const skillName = skillMatch[1];
            if (state.removedSkillNames.has(skillName)) {
                // Block this skill invocation
                ctx.ui.notify(
                    `Skill "${skillName}" is disabled by skills.whitelist in pi-mp-my-agent.config.json. ` +
                        `Run /reload after updating the whitelist to enable it.`,
                );
                return { action: "handled" };
            }
        }
        return { action: "continue" };
    });
}
