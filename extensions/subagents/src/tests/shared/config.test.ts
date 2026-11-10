import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  loadConfig,
  createConfigStore,
  CONFIG_FILE_NAME,
} from "../../../../shared/config.ts";

describe("loadConfig", () => {
  let tempDir: string;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "config-test-"));
    warnSpy = vi.spyOn(console, "warn").mockReturnValue(undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function writeConfig(content: string) {
    fs.writeFileSync(path.join(tempDir, CONFIG_FILE_NAME), content, "utf8");
  }

  it("returns defaults when the config file is missing", async () => {
    const config = await loadConfig(tempDir);
    expect(config).toEqual({ agents: { whitelist: [] } });
    expect(Object.isFrozen(config)).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("returns merged values for a valid config file", async () => {
    writeConfig(
      JSON.stringify({ agents: { whitelist: ["code-reviewer", "worker"] } }),
    );
    const config = await loadConfig(tempDir);
    expect(config).toEqual({
      agents: { whitelist: ["code-reviewer", "worker"] },
    });
    expect(Object.isFrozen(config)).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("fills missing values with defaults", async () => {
    writeConfig(JSON.stringify({}));
    const config = await loadConfig(tempDir);
    expect(config).toEqual({ agents: { whitelist: [] } });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("returns defaults and warns on invalid JSON", async () => {
    writeConfig("{ not json");
    const config = await loadConfig(tempDir);
    expect(config).toEqual({ agents: { whitelist: [] } });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("parse error"),
    );
  });

  it("returns defaults and warns on validation failure", async () => {
    writeConfig(JSON.stringify({ agents: { whitelist: "not-an-array" } }));
    const config = await loadConfig(tempDir);
    expect(config).toEqual({ agents: { whitelist: [] } });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("failed validation"),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/agents\/whitelist/),
    );
  });

  it("returns defaults and warns on unknown config keys", async () => {
    writeConfig(
      JSON.stringify({ agents: { whitelist: [] }, unknownKey: true }),
    );
    const config = await loadConfig(tempDir);
    expect(config).toEqual({ agents: { whitelist: [] } });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("failed validation"),
    );
  });

  it("returns defaults and warns on non-ENOENT file-system errors", async () => {
    fs.mkdirSync(path.join(tempDir, CONFIG_FILE_NAME));
    const config = await loadConfig(tempDir);
    expect(config).toEqual({ agents: { whitelist: [] } });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("file-system error"),
    );
  });
});

describe("createConfigStore", () => {
  let tempDir: string;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "config-test-"));
    warnSpy = vi.spyOn(console, "warn").mockReturnValue(undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function writeConfig(content: string) {
    fs.writeFileSync(path.join(tempDir, CONFIG_FILE_NAME), content, "utf8");
  }

  it("getConfig throws before loadConfig is called", () => {
    const store = createConfigStore();
    expect(() => store.getConfig()).toThrow(
      "Configuration has not been loaded. Call loadConfig() first.",
    );
  });

  it("isLoaded returns false before loadConfig and true after", async () => {
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
    });
    expect(store.get("agents")).toEqual({ whitelist: ["code-reviewer"] });
  });

  it("stores are isolated from each other", async () => {
    const tempDirA = fs.mkdtempSync(path.join(os.tmpdir(), "config-test-"));
    const tempDirB = fs.mkdtempSync(path.join(os.tmpdir(), "config-test-"));
    try {
      fs.writeFileSync(
        path.join(tempDirA, CONFIG_FILE_NAME),
        JSON.stringify({ agents: { whitelist: ["a"] } }),
      );
      fs.writeFileSync(
        path.join(tempDirB, CONFIG_FILE_NAME),
        JSON.stringify({ agents: { whitelist: ["b"] } }),
      );
      const storeA = createConfigStore();
      const storeB = createConfigStore();
      await storeA.loadConfig(tempDirA);
      await storeB.loadConfig(tempDirB);
      expect(storeA.getConfig()).toEqual({ agents: { whitelist: ["a"] } });
      expect(storeB.getConfig()).toEqual({ agents: { whitelist: ["b"] } });
    } finally {
      fs.rmSync(tempDirA, { recursive: true, force: true });
      fs.rmSync(tempDirB, { recursive: true, force: true });
    }
  });

  it("deep freezes nested objects and arrays", async () => {
    writeConfig(JSON.stringify({ agents: { whitelist: ["code-reviewer"] } }));
    const store = createConfigStore();
    const config = await store.loadConfig(tempDir);
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.agents)).toBe(true);
    expect(Object.isFrozen(config.agents.whitelist)).toBe(true);
  });
});
