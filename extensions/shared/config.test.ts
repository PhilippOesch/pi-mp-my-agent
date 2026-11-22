import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as path from "node:path";
import { matchesKey } from "@earendil-works/pi-tui";
import {
  loadConfig,
  createConfigStore,
  CONFIG_FILE_NAME,
  isKeyId,
} from "./config.ts";
import { resetFs, seedFs } from "./testing/fs-mock.ts";
import { MockFsError } from "./testing/__mocks__/node:fs/promises.ts";

vi.mock(
  "node:fs/promises",
  async () => import("./testing/__mocks__/node:fs/promises.ts"),
);

describe("loadConfig", () => {
  const tempDir: string = "some/path";
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetFs();
    warnSpy = vi.spyOn(console, "warn").mockReturnValue(undefined);
  });

  it("returns defaults when the config file is missing", async () => {
    const config = await loadConfig(tempDir);
    expect(config).toEqual({
      agents: { whitelist: [] },
      skills: { whitelist: [] },
      readModeToggle: {},
    });
    expect(Object.isFrozen(config)).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("returns merged values for a valid config file", async () => {
    seedFs({
      [path.join(tempDir, CONFIG_FILE_NAME)]: JSON.stringify({
        agents: { whitelist: ["code-reviewer", "worker"] },
      }),
    });
    const config = await loadConfig(tempDir);
    expect(config).toEqual({
      agents: { whitelist: ["code-reviewer", "worker"] },
      skills: { whitelist: [] },
      readModeToggle: {},
    });
    expect(Object.isFrozen(config)).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("fills missing values with defaults", async () => {
    seedFs({
      [path.join(tempDir, CONFIG_FILE_NAME)]: JSON.stringify({}),
    });
    const config = await loadConfig(tempDir);
    expect(config).toEqual({
      agents: { whitelist: [] },
      skills: { whitelist: [] },
      readModeToggle: {},
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("returns defaults and warns on invalid JSON", async () => {
    seedFs({
      [path.join(tempDir, CONFIG_FILE_NAME)]: "{ not json",
    });
    const config = await loadConfig(tempDir);
    expect(config).toEqual({
      agents: { whitelist: [] },
      skills: { whitelist: [] },
      readModeToggle: {},
    });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("parse error"),
    );
  });

  it("returns defaults and warns on validation failure", async () => {
    seedFs({
      [path.join(tempDir, CONFIG_FILE_NAME)]: JSON.stringify({
        agents: { whitelist: "not-an-array" },
      }),
    });
    const config = await loadConfig(tempDir);
    expect(config).toEqual({
      agents: { whitelist: [] },
      skills: { whitelist: [] },
      readModeToggle: {},
    });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("failed validation"),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/agents\/whitelist/),
    );
  });

  it("returns defaults and warns on unknown config keys", async () => {
    seedFs({
      [path.join(tempDir, CONFIG_FILE_NAME)]: JSON.stringify({
        agents: { whitelist: [] },
        unknownKey: true,
      }),
    });
    const config = await loadConfig(tempDir);
    expect(config).toEqual({
      agents: { whitelist: [] },
      skills: { whitelist: [] },
      readModeToggle: {},
    });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("failed validation"),
    );
  });

  it("returns defaults and warns on non-ENOENT file-system errors", async () => {
    const fs = await import("node:fs/promises");
    vi.mocked(fs.readFile).mockImplementation(() => {
      throw new MockFsError("UNKNOWN", "mock file-system error");
    });
    const config = await loadConfig(tempDir);
    expect(config).toEqual({
      agents: { whitelist: [] },
      skills: { whitelist: [] },
      readModeToggle: {},
    });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("file-system error"),
    );
  });

  it("keeps a valid replacement and freezes it", async () => {
    seedFs({
      [path.join(tempDir, CONFIG_FILE_NAME)]: JSON.stringify({
        agents: { whitelist: ["worker"] },
        readModeToggle: { keybinding: "shift+ctrl+pageUp" },
      }),
    });
    const config = await loadConfig(tempDir);
    expect(config).toEqual({
      agents: { whitelist: ["worker"] },
      skills: { whitelist: [] },
      readModeToggle: { keybinding: "shift+ctrl+pageUp" },
    });
    expect(Object.isFrozen(config.readModeToggle)).toBe(true);
    expect(Object.isFrozen(config.skills)).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it.each([42, null, [], "ctrl+ctrl+m", "ctrl+bad", "Ctrl+Shift+M", "ctrl+m+"])(
    "warns and preserves the whitelist for invalid keybinding %j",
    async (keybinding) => {
      seedFs({
        [path.join(tempDir, CONFIG_FILE_NAME)]: JSON.stringify({
          agents: { whitelist: ["worker"] },
          readModeToggle: { keybinding },
        }),
      });
      const config = await loadConfig(tempDir);
      expect(config).toEqual({
        agents: { whitelist: ["worker"] },
        skills: { whitelist: [] },
        readModeToggle: {},
      });
      expect(Object.isFrozen(config.readModeToggle)).toBe(true);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("invalid readModeToggle.keybinding"),
      );
    },
  );

  it("warns and preserves the whitelist for a non-object setting", async () => {
    seedFs({
      [path.join(tempDir, CONFIG_FILE_NAME)]: JSON.stringify({
        agents: { whitelist: ["worker"] },
        readModeToggle: 42,
      }),
    });
    expect(await loadConfig(tempDir)).toEqual({
      agents: { whitelist: ["worker"] },
      skills: { whitelist: [] },
      readModeToggle: {},
    });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("invalid readModeToggle.keybinding"),
    );
  });

  it("does not mask unknown properties alongside an invalid keybinding", async () => {
    seedFs({
      [path.join(tempDir, CONFIG_FILE_NAME)]: JSON.stringify({
        agents: { whitelist: ["worker"] },
        readModeToggle: { keybinding: 42, unknown: true },
      }),
    });
    expect(await loadConfig(tempDir)).toEqual({
      agents: { whitelist: [] },
      skills: { whitelist: [] },
      readModeToggle: {},
    });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("failed validation"),
    );
  });
});

describe("isKeyId", () => {
  it.each([
    "ctrl+shift+m",
    "shift+ctrl+m",
    "ctrl+pageUp",
    "alt+f12",
    "super+k",
    "+",
    "ctrl++",
    "f1",
    "shift+ctrl+alt+super+?",
  ])("accepts %s", (key) => {
    expect(isKeyId(key)).toBe(true);
  });
  it.each([
    null,
    1,
    [],
    "",
    "ctrl+ctrl+m",
    "ctrl+bad",
    "Ctrl+Shift+M",
    "ctrl+m+",
    "ctrl+",
    "f13",
    "pageup",
    "ctrl+shift+ctrl+m",
  ])("rejects %j", (key) => {
    expect(isKeyId(key)).toBe(false);
  });

  it.each([
    ["shift+ctrl+m", "\u001b[109;6u"],
    ["ctrl+shift+m", "\u001b[109;6u"],
    ["ctrl+pageUp", "\u001b[5;5~"],
    ["shift+ctrl+pageUp", "\u001b[5;6~"],
  ])("matches Pi's shortcut matcher for %s", (key, input) => {
    expect(isKeyId(key)).toBe(true);
    if (!isKeyId(key)) throw new Error(`Invalid key: ${key}`);
    expect(matchesKey(input, key)).toBe(true);
  });

  it("matches literal + in the project's Pi dependency", () => {
    expect(isKeyId("+")).toBe(true);
    expect(isKeyId("ctrl++")).toBe(true);
    expect(matchesKey("+", "+")).toBe(true);
    expect(matchesKey("\u001b[43;5u", "ctrl++")).toBe(true);
  });
});

describe("createConfigStore", () => {
  let tempDir: string;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tempDir = `some/store-path-${Date.now()}`;
    warnSpy = vi.spyOn(console, "warn").mockReturnValue(undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  function writeConfig(content?: string | null) {
    seedFs({
      [path.join(tempDir, CONFIG_FILE_NAME)]: content as string,
    });
  }

  it("getConfig throws before loadConfig is called", () => {
    const store = createConfigStore();
    expect(() => store.getConfig()).toThrow(
      "Configuration has not been loaded. Call loadConfig() first.",
    );
  });

  it("isLoaded returns false before loadConfig and true after", async () => {
    seedFs({ [path.join(tempDir, CONFIG_FILE_NAME)]: JSON.stringify({}) });
    const store = createConfigStore();
    expect(store.isLoaded()).toBe(false);
    await store.loadConfig(tempDir);
    expect(store.isLoaded()).toBe(true);
  });

  it("getConfig returns the config loaded in the same store", async () => {
    writeConfig(JSON.stringify({ agents: { whitelist: ["code-reviewer"] } }));
    const store = createConfigStore();
    const loaded = await store.loadConfig(tempDir);
    expect(store.getConfig()).toBe(loaded);
    expect(store.getConfig()).toEqual({
      agents: { whitelist: ["code-reviewer"] },
      skills: { whitelist: [] },
      readModeToggle: {},
    });
    expect(store.get("agents")).toEqual({ whitelist: ["code-reviewer"] });
    expect(store.get("skills")).toEqual({ whitelist: [] });
  });

  it("stores are isolated from each other", async () => {
    const tempDirA = "store/a";
    const tempDirB = "store/b";
    seedFs({
      [path.join(tempDirA, CONFIG_FILE_NAME)]: JSON.stringify({
        agents: { whitelist: ["a"] },
      }),
      [path.join(tempDirB, CONFIG_FILE_NAME)]: JSON.stringify({
        agents: { whitelist: ["b"] },
      }),
    });
    const storeA = createConfigStore();
    const storeB = createConfigStore();
    await storeA.loadConfig(tempDirA);
    await storeB.loadConfig(tempDirB);
    expect(storeA.getConfig()).toEqual({
      agents: { whitelist: ["a"] },
      skills: { whitelist: [] },
      readModeToggle: {},
    });
    expect(storeB.getConfig()).toEqual({
      agents: { whitelist: ["b"] },
      skills: { whitelist: [] },
      readModeToggle: {},
    });
  });

  it("deep freezes nested objects and arrays", async () => {
    writeConfig(JSON.stringify({ agents: { whitelist: ["code-reviewer"] } }));
    const store = createConfigStore();
    const config = await store.loadConfig(tempDir);
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.agents)).toBe(true);
    expect(Object.isFrozen(config.agents.whitelist)).toBe(true);
    expect(Object.isFrozen(config.skills)).toBe(true);
    expect(Object.isFrozen(config.skills.whitelist)).toBe(true);
    expect(Object.isFrozen(config.readModeToggle)).toBe(true);
  });

  it("parses skills whitelist from config", async () => {
    seedFs({
      [path.join(tempDir, CONFIG_FILE_NAME)]: JSON.stringify({
        skills: { whitelist: ["tdd", "refactor"] },
      }),
    });
    const config = await loadConfig(tempDir);
    expect(config).toEqual({
      agents: { whitelist: [] },
      skills: { whitelist: ["tdd", "refactor"] },
      readModeToggle: {},
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("validates skills whitelist is an array", async () => {
    seedFs({
      [path.join(tempDir, CONFIG_FILE_NAME)]: JSON.stringify({
        skills: { whitelist: "not-an-array" },
      }),
    });
    const config = await loadConfig(tempDir);
    expect(config).toEqual({
      agents: { whitelist: [] },
      skills: { whitelist: [] },
      readModeToggle: {},
    });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("failed validation"),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/skills\/whitelist/),
    );
  });
});
