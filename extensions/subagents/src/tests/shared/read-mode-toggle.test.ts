import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { CONFIG_FILE_NAME } from "../../../../shared/config.ts";
import readModeToggleExtension from "../../../../read-mode-toggle/index.ts";

const agentDir = vi.hoisted(() => ({ value: "" }));
vi.mock("../../../../shared/config.ts", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../../shared/config.ts")>();
  return { ...actual, loadConfig: () => actual.loadConfig(agentDir.value) };
});

describe("read-mode-toggle shortcut", () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    agentDir.value = fs.mkdtempSync(
      path.join(os.tmpdir(), "read-mode-toggle-test-"),
    );
    warn = vi.spyOn(console, "warn").mockReturnValue(undefined);
  });

  afterEach(() => {
    warn.mockRestore();
    fs.rmSync(agentDir.value, { recursive: true, force: true });
  });

  async function register(config?: unknown) {
    if (config !== undefined)
      fs.writeFileSync(
        path.join(agentDir.value, CONFIG_FILE_NAME),
        JSON.stringify(config),
      );
    const registerShortcut = vi.fn();
    const registerCommand = vi.fn();
    const on = vi.fn();
    await readModeToggleExtension({
      registerShortcut,
      registerCommand,
      on,
    } as unknown as ExtensionAPI);
    expect(registerShortcut).toHaveBeenCalledTimes(1);
    expect(registerCommand).toHaveBeenCalledWith("mode", expect.any(Object));
    return registerShortcut;
  }

  it("registers the existing default when unset", async () => {
    expect((await register()).mock.calls[0]?.[0]).toBe("ctrl+shift+m");
    expect(warn).not.toHaveBeenCalled();
  });

  it("replaces the default with the configured shortcut", async () => {
    expect(
      (await register({ readModeToggle: { keybinding: "alt+ctrl+x" } })).mock
        .calls[0]?.[0],
    ).toBe("alt+ctrl+x");
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns and uses the default for an invalid shortcut", async () => {
    expect(
      (await register({ readModeToggle: { keybinding: "ctrl+ctrl+x" } })).mock
        .calls[0]?.[0],
    ).toBe("ctrl+shift+m");
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("invalid readModeToggle.keybinding"),
    );
  });
});
