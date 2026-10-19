import { describe, expect, it } from "vitest";
import { buildMemoryContext } from "./context.ts";
import type { MemoryConfig } from "./config.ts";

const baseConfig: MemoryConfig = {
    dir: "/tmp/mem/",
    snapshot: "stable",
    noSearch: false,
    summarizeTransitions: false,
    exitSummary: true,
    exitSummaryReasoningEffort: "low",
    exitSummaryTimeoutMs: 10000,
    contextMaxChars: 16000,
    contextLongTermMaxChars: 4000,
    contextScratchpadMaxChars: 2000,
    contextDailyMaxChars: 3000,
    contextSearchMaxChars: 2500,
};

describe("context", () => {
    it("includes guidance header and sections in priority order", () => {
        const ctx = buildMemoryContext({
            config: baseConfig,
            scratchpad: "- [ ] open item",
            today: "today note",
            longTerm: "long term note",
            yesterday: "yesterday note",
            searchResults: "search hit",
            caveat: "stable caveat",
        });
        expect(ctx).toContain("## Memory");
        expect(ctx).toContain("(stable caveat)");
        expect(ctx).toContain("Use the memory_write tool");
        expect(ctx.indexOf("## Open Scratchpad")).toBeLessThan(
            ctx.indexOf("## Today"),
        );
        expect(ctx.indexOf("## Today")).toBeLessThan(
            ctx.indexOf("## Relevant memories"),
        );
        expect(ctx.indexOf("## Relevant memories")).toBeLessThan(
            ctx.indexOf("## MEMORY.md"),
        );
        expect(ctx.indexOf("## MEMORY.md")).toBeLessThan(
            ctx.indexOf("## Yesterday"),
        );
    });

    it("omits empty sections", () => {
        const ctx = buildMemoryContext({
            config: baseConfig,
            scratchpad: "- [ ] item",
            today: "",
            longTerm: "",
            yesterday: "",
            searchResults: "",
            caveat: "",
        });
        expect(ctx).toContain("Open Scratchpad");
        expect(ctx).not.toContain("## Today");
        expect(ctx).not.toContain("## MEMORY.md");
    });

    it("truncates sections", () => {
        const ctx = buildMemoryContext({
            config: baseConfig,
            scratchpad: "x".repeat(5000),
            today: "",
            longTerm: "",
            yesterday: "",
            searchResults: "",
            caveat: "",
        });
        const scratchSection = ctx.split("## ")[1]!;
        expect(scratchSection.length).toBeLessThan(2500);
        expect(ctx).toContain("[truncated]");
    });

    it("applies overall context cap", () => {
        const cfg = { ...baseConfig, contextMaxChars: 100 };
        const ctx = buildMemoryContext({
            config: cfg,
            scratchpad: "scratch",
            today: "today",
            longTerm: "longterm",
            yesterday: "yesterday",
            searchResults: "search",
            caveat: "",
        });
        expect(ctx.length).toBeLessThanOrEqual(100);
        expect(ctx).toContain("[truncated overall context");
    });

    it("uses middle truncation for MEMORY.md", () => {
        const cfg = { ...baseConfig, contextLongTermMaxChars: 20 };
        const ctx = buildMemoryContext({
            config: cfg,
            scratchpad: "",
            today: "",
            longTerm: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
            yesterday: "",
            searchResults: "",
            caveat: "",
        });
        expect(ctx).toContain("A");
        expect(ctx).toContain("Z");
        expect(ctx).toContain("[truncated]");
    });
});
