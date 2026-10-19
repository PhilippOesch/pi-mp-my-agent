import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadMemoryConfig } from "./config.ts";

describe("config", () => {
    function clearMemoryEnv(): void {
        for (const key of Object.keys(process.env)) {
            if (key.startsWith("PI_MEMORY_")) {
                delete process.env[key];
            }
        }
    }

    beforeEach(clearMemoryEnv);
    afterEach(clearMemoryEnv);

    it("uses pi-memory defaults", () => {
        const cfg = loadMemoryConfig();
        expect(cfg.dir.endsWith(".pi/agent/memory/")).toBe(true);
        expect(cfg.snapshot).toBe("stable");
        expect(cfg.noSearch).toBe(false);
        expect(cfg.summarizeTransitions).toBe(false);
        expect(cfg.exitSummary).toBe(true);
        expect(cfg.exitSummaryModel).toBeUndefined();
        expect(cfg.exitSummaryReasoningEffort).toBe("low");
        expect(cfg.exitSummaryTimeoutMs).toBe(10000);
        expect(cfg.contextMaxChars).toBe(16000);
        expect(cfg.contextLongTermMaxChars).toBe(4000);
        expect(cfg.contextScratchpadMaxChars).toBe(2000);
        expect(cfg.contextDailyMaxChars).toBe(3000);
        expect(cfg.contextSearchMaxChars).toBe(2500);
    });

    it("reads overrides", () => {
        process.env.PI_MEMORY_DIR = "/tmp/mem";
        process.env.PI_MEMORY_SNAPSHOT = "refresh";
        process.env.PI_MEMORY_NO_SEARCH = "1";
        process.env.PI_MEMORY_SUMMARIZE_TRANSITIONS = "true";
        process.env.PI_MEMORY_EXIT_SUMMARY = "0";
        process.env.PI_MEMORY_EXIT_SUMMARY_MODEL = "openai/gpt-4o";
        process.env.PI_MEMORY_EXIT_SUMMARY_REASONING_EFFORT = "high";
        process.env.PI_MEMORY_EXIT_SUMMARY_TIMEOUT_MS = "5000";
        process.env.PI_MEMORY_CONTEXT_MAX_CHARS = "8000";
        process.env.PI_MEMORY_CONTEXT_LONG_TERM_MAX_CHARS = "2000";
        process.env.PI_MEMORY_CONTEXT_SCRATCHPAD_MAX_CHARS = "1000";
        process.env.PI_MEMORY_CONTEXT_DAILY_MAX_CHARS = "1500";
        process.env.PI_MEMORY_CONTEXT_SEARCH_MAX_CHARS = "1200";

        const cfg = loadMemoryConfig();
        expect(cfg.dir).toBe("/tmp/mem/");
        expect(cfg.snapshot).toBe("refresh");
        expect(cfg.noSearch).toBe(true);
        expect(cfg.summarizeTransitions).toBe(true);
        expect(cfg.exitSummary).toBe(false);
        expect(cfg.exitSummaryModel).toBe("openai/gpt-4o");
        expect(cfg.exitSummaryReasoningEffort).toBe("high");
        expect(cfg.exitSummaryTimeoutMs).toBe(5000);
        expect(cfg.contextMaxChars).toBe(8000);
        expect(cfg.contextLongTermMaxChars).toBe(2000);
        expect(cfg.contextScratchpadMaxChars).toBe(1000);
        expect(cfg.contextDailyMaxChars).toBe(1500);
        expect(cfg.contextSearchMaxChars).toBe(1200);
    });

    it("falls back to defaults for garbage values", () => {
        process.env.PI_MEMORY_SNAPSHOT = "banana";
        process.env.PI_MEMORY_EXIT_SUMMARY_TIMEOUT_MS = "not-a-number";
        process.env.PI_MEMORY_CONTEXT_MAX_CHARS = "-5";
        process.env.PI_MEMORY_NO_SEARCH = "maybe";

        const cfg = loadMemoryConfig();
        expect(cfg.snapshot).toBe("stable");
        expect(cfg.exitSummaryTimeoutMs).toBe(10000);
        expect(cfg.contextMaxChars).toBe(16000);
        expect(cfg.noSearch).toBe(false);
    });

    it("exitSummary stays enabled for any non-disabling value", () => {
        for (const value of ["maybe", "yes", "1", "true", "on"]) {
            process.env.PI_MEMORY_EXIT_SUMMARY = value;
            expect(loadMemoryConfig().exitSummary).toBe(true);
        }
    });

    it("exitSummary disables only for explicit disable values", () => {
        for (const value of ["0", "off", "false", "no"]) {
            process.env.PI_MEMORY_EXIT_SUMMARY = value;
            expect(loadMemoryConfig().exitSummary).toBe(false);
        }
    });

    it("falls back to default dir when PI_MEMORY_DIR is empty", () => {
        process.env.PI_MEMORY_DIR = "";
        const cfg = loadMemoryConfig();
        expect(cfg.dir.endsWith(".pi/agent/memory/")).toBe(true);
    });

    it("expands ~ in dir", () => {
        process.env.PI_MEMORY_DIR = "~/custom-memory";
        const cfg = loadMemoryConfig();
        expect(cfg.dir).not.toContain("~");
        expect(cfg.dir.endsWith("custom-memory/")).toBe(true);
    });
});
