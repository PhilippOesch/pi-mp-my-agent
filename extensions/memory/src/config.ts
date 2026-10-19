import { homedir } from "node:os";
import { join } from "node:path";

export type SnapshotMode = "stable" | "refresh" | "per-turn";

export interface MemoryConfig {
    dir: string;
    snapshot: SnapshotMode;
    noSearch: boolean;
    summarizeTransitions: boolean;
    exitSummary: boolean;
    exitSummaryModel?: string;
    exitSummaryReasoningEffort: string;
    exitSummaryTimeoutMs: number;
    contextMaxChars: number;
    contextLongTermMaxChars: number;
    contextScratchpadMaxChars: number;
    contextDailyMaxChars: number;
    contextSearchMaxChars: number;
}

function expandHome(p: string): string {
    if (p.startsWith("~/")) return join(homedir(), p.slice(2));
    if (p === "~") return homedir();
    return p;
}

function parseDir(raw?: string): string {
    const base =
        raw && raw.trim().length > 0
            ? expandHome(raw)
            : join(homedir(), ".pi/agent/memory");
    return base.endsWith("/") ? base : `${base}/`;
}

function parseExitSummary(raw?: string): boolean {
    if (raw === undefined) return true;
    return !/^(0|off|false|no)$/i.test(raw.trim());
}

function parseSnapshot(raw?: string): SnapshotMode {
    if (raw === "refresh" || raw === "per-turn") return raw;
    return "stable";
}

function parseBool(raw?: string, defaultValue = false): boolean {
    if (raw === undefined) return defaultValue;
    return /^(1|true|yes|on)$/i.test(raw);
}

function parsePositiveInt(raw?: string, defaultValue: number = 0): number {
    if (raw === undefined) return defaultValue;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n))
        return defaultValue;
    return n;
}

export function loadMemoryConfig(): MemoryConfig {
    return {
        dir: parseDir(process.env.PI_MEMORY_DIR),
        snapshot: parseSnapshot(process.env.PI_MEMORY_SNAPSHOT),
        noSearch: parseBool(process.env.PI_MEMORY_NO_SEARCH, false),
        summarizeTransitions: parseBool(
            process.env.PI_MEMORY_SUMMARIZE_TRANSITIONS,
            false,
        ),
        exitSummary: parseExitSummary(process.env.PI_MEMORY_EXIT_SUMMARY),
        exitSummaryModel: process.env.PI_MEMORY_EXIT_SUMMARY_MODEL || undefined,
        exitSummaryReasoningEffort:
            process.env.PI_MEMORY_EXIT_SUMMARY_REASONING_EFFORT || "low",
        exitSummaryTimeoutMs: parsePositiveInt(
            process.env.PI_MEMORY_EXIT_SUMMARY_TIMEOUT_MS,
            10000,
        ),
        contextMaxChars: parsePositiveInt(
            process.env.PI_MEMORY_CONTEXT_MAX_CHARS,
            16000,
        ),
        contextLongTermMaxChars: parsePositiveInt(
            process.env.PI_MEMORY_CONTEXT_LONG_TERM_MAX_CHARS,
            4000,
        ),
        contextScratchpadMaxChars: parsePositiveInt(
            process.env.PI_MEMORY_CONTEXT_SCRATCHPAD_MAX_CHARS,
            2000,
        ),
        contextDailyMaxChars: parsePositiveInt(
            process.env.PI_MEMORY_CONTEXT_DAILY_MAX_CHARS,
            3000,
        ),
        contextSearchMaxChars: parsePositiveInt(
            process.env.PI_MEMORY_CONTEXT_SEARCH_MAX_CHARS,
            2500,
        ),
    };
}
