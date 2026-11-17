import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { Type, type Static } from "typebox";
import type { KeyId } from "@earendil-works/pi-tui";
import { Value } from "typebox/value";
import { join } from "node:path";
import { errorMessage, readJson } from "./utils.ts";

export const CONFIG_FILE_NAME = "pi-mp-my-agent.config.json";

// Matches the installed Pi KeyId union (keys.d.ts) and its shortcut matcher.
// Pi does not export a validator for configuration strings; parseKey parses input bytes.
const SYMBOL_KEYS = new Set("`-=[]\\;',./!@#$%^&*()_+|~{}:<>?");
const SPECIAL_KEYS = new Set([
  "escape",
  "esc",
  "enter",
  "return",
  "tab",
  "space",
  "backspace",
  "delete",
  "insert",
  "clear",
  "home",
  "end",
  "pageUp",
  "pageDown",
  "up",
  "down",
  "left",
  "right",
  ...Array.from({ length: 12 }, (_, i) => `f${i + 1}`),
]);
const MODIFIERS = ["ctrl", "shift", "alt", "super"] as const;

export function isKeyId(value: unknown): value is KeyId {
  if (typeof value !== "string") return false;
  let key = value;
  const seen = new Set<string>();
  while (true) {
    const modifier = MODIFIERS.find((name) => key.startsWith(`${name}+`));
    if (!modifier) break;
    if (seen.has(modifier)) return false;
    seen.add(modifier);
    key = key.slice(modifier.length + 1);
  }
  return (
    SPECIAL_KEYS.has(key) ||
    (key.length === 1 && (/[a-z0-9]/.test(key) || SYMBOL_KEYS.has(key)))
  );
}

export const PackageConfigSchema = Type.Object(
  {
    agents: Type.Object(
      {
        whitelist: Type.Array(Type.String(), { default: [] }),
      },
      { default: {}, additionalProperties: false },
    ),
    readModeToggle: Type.Object(
      { keybinding: Type.Optional(Type.String()) },
      { default: {}, additionalProperties: false },
    ),
  },
  { default: {}, additionalProperties: false },
);

export type Config = Omit<
  Static<typeof PackageConfigSchema>,
  "readModeToggle"
> & {
  readModeToggle: { keybinding?: KeyId };
};

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach(deepFreeze);
  } else if (value !== null && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
  }
  return Object.freeze(value);
}

function defaultConfig(): Config {
  return deepFreeze({ agents: { whitelist: [] }, readModeToggle: {} });
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

  // Only recover from this setting's errors. All other schema errors still
  // invalidate the entire file, including unknown properties in this object.
  if (!Array.isArray(raw)) {
    const config = raw as Record<string, unknown>;
    const setting = config.readModeToggle;
    if (
      setting !== undefined &&
      (setting === null ||
        typeof setting !== "object" ||
        Array.isArray(setting))
    ) {
      console.warn(
        `[config] invalid readModeToggle.keybinding in ${configPath}. Using default shortcut.`,
      );
      config.readModeToggle = {};
    } else if (
      setting &&
      Object.hasOwn(setting, "keybinding") &&
      !isKeyId((setting as Record<string, unknown>).keybinding)
    ) {
      console.warn(
        `[config] invalid readModeToggle.keybinding in ${configPath}. Using default shortcut.`,
      );
      delete (setting as Record<string, unknown>).keybinding;
    }
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
