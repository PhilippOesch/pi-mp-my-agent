import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { Type, type Static } from "typebox";
import { Value } from "typebox/value";
import { join } from "node:path";
import { errorMessage, readJson } from "./utils.ts";

export const CONFIG_FILE_NAME = "pi-mp-my-agent.config.json";

export const PackageConfigSchema = Type.Object(
  {
    agents: Type.Object(
      {
        whitelist: Type.Array(Type.String(), { default: [] }),
      },
      { default: {}, additionalProperties: false },
    ),
  },
  { default: {}, additionalProperties: false },
);

export type Config = Static<typeof PackageConfigSchema>;

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach(deepFreeze);
  } else if (value !== null && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
  }
  return Object.freeze(value);
}

function defaultConfig(): Config {
  return deepFreeze({ agents: { whitelist: [] } });
}

function formatValidationErrors(value: unknown): string {
  return [...Value.Errors(PackageConfigSchema, value)]
    .map((error) => `${error.instancePath ?? "<root>"}: ${error.message}`)
    .join("; ");
}

export async function loadConfig(agentDir?: string): Promise<Config> {
  const configDir = agentDir ?? getAgentDir();
  const configPath = join(configDir, CONFIG_FILE_NAME);

  let raw: unknown;
  try {
    raw = await readJson(configPath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    const reason =
      code === undefined ? "parse error" : `file-system error (${code})`;
    console.warn(
      `[config] ${reason} in ${configPath}: ${errorMessage(error)}. Using defaults.`,
    );
    return defaultConfig();
  }

  if (raw === null || typeof raw !== "object") {
    console.warn(
      `[config] ${configPath} must contain an object. Using defaults.`,
    );
    return defaultConfig();
  }

  raw = Value.Default(PackageConfigSchema, raw);

  if (!Value.Check(PackageConfigSchema, raw)) {
    console.warn(
      `[config] ${configPath} failed validation: ${formatValidationErrors(raw)}. Using defaults.`,
    );
    return defaultConfig();
  }

  return deepFreeze(raw as Config);
}

export interface ConfigStore {
  readonly loadConfig: (agentDir?: string) => Promise<Config>;
  readonly getConfig: () => Config;
  readonly get: <K extends keyof Config>(key: K) => Config[K];
  readonly isLoaded: () => boolean;
}

export function createConfigStore(): ConfigStore {
  let cachedConfig: Config | undefined;

  async function load(agentDir?: string): Promise<Config> {
    cachedConfig = await loadConfig(agentDir);
    return cachedConfig;
  }

  function getConfig(): Config {
    if (cachedConfig === undefined) {
      throw new Error(
        "Configuration has not been loaded. Call loadConfig() first.",
      );
    }
    return cachedConfig;
  }

  function get<K extends keyof Config>(key: K): Config[K] {
    return getConfig()[key];
  }

  function isLoaded(): boolean {
    return cachedConfig !== undefined;
  }

  return { loadConfig: load, getConfig, get, isLoaded };
}
