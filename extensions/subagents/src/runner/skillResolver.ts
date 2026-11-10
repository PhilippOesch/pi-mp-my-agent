/**
 * Resolve skill names to filesystem paths using Pi's built-in resource loader.
 *
 * Skills can live in the user agent dir, the project agent dir, or in installed
 * packages. Rather than reimplementing that discovery, we ask Pi's
 * DefaultPackageManager for the full set of resolved skill resources and then
 * load them to obtain their declared names.
 */

import {
  DefaultPackageManager,
  loadSkills,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";

export interface SkillResolutionContext {
  cwd: string;
  agentDir: string;
  projectTrusted: boolean;
}

/**
 * Resolve a list of skill names to the filesystem paths Pi would load them from.
 *
 * Unknown skills produce an error so the caller can fail fast rather than
 * silently spawn a subagent without the skill it declared.
 */
export async function resolveSkillPaths(
  names: string[],
  ctx: SkillResolutionContext,
): Promise<{ paths: string[]; missing: string[] }> {
  if (names.length === 0) return { paths: [], missing: [] };

  const settingsManager = SettingsManager.create(ctx.cwd, ctx.agentDir, {
    projectTrusted: ctx.projectTrusted,
  });

  const packageManager = new DefaultPackageManager({
    cwd: ctx.cwd,
    agentDir: ctx.agentDir,
    settingsManager,
  });

  const resolved = await packageManager.resolve();
  const skillPaths = resolved.skills
    .filter((resource) => resource.enabled)
    .map((resource) => resource.path);

  const loaded = loadSkills({
    cwd: ctx.cwd,
    agentDir: ctx.agentDir,
    skillPaths,
    includeDefaults: false,
  });

  const nameToPath = new Map<string, string>();
  for (const skill of loaded.skills) {
    if (!nameToPath.has(skill.name)) {
      nameToPath.set(skill.name, skill.filePath);
    }
  }

  const paths: string[] = [];
  const missing: string[] = [];
  for (const name of names) {
    const resolvedPath = nameToPath.get(name);
    if (resolvedPath) {
      paths.push(resolvedPath);
    } else {
      missing.push(name);
    }
  }

  return { paths, missing };
}
