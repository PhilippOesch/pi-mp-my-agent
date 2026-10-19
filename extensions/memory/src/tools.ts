import { StringEnum, Type } from "@earendil-works/pi-ai";
import type {
    ExtensionToolContext,
    ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { MemoryConfig } from "./config.ts";
import type { SearchBackend } from "./search/types.ts";
import { clampSearchLimit } from "./search/types.ts";
import type { MemoryPaths } from "./storage/files.ts";
import {
    appendDailyEntry,
    appendLongTermEntry,
    forgetBlocks,
    listDailyFiles,
    overwriteLongTermEntry,
    readMemoryFile,
} from "./storage/files.ts";
import {
    isValidDailyDate,
    nowTimestamp,
    shortSessionId,
    todayStr,
} from "./storage/dates.ts";
import {
    clearDoneScratchpad,
    doneScratchpad,
    parseScratchpad,
    serializeScratchpad,
    undoScratchpad,
} from "./storage/scratchpad.ts";
import {
    restoreRecoveryRecord,
    writeRecoveryRecord,
} from "./storage/recovery.ts";
import type { SnapshotState } from "./snapshot.ts";

const TARGET_SCHEMA = StringEnum(["long_term", "daily"], {
    description: "Where to write the memory",
});
const TARGET_WITH_SCRATCHPAD_SCHEMA = StringEnum(
    ["long_term", "scratchpad", "daily", "list"],
    { description: "Which memory file to read" },
);
const MODE_SCHEMA = StringEnum(["append", "overwrite"], {
    description: "How to write long-term memory",
    default: "append",
});
const SCRATCHPAD_ACTION_SCHEMA = StringEnum(
    ["add", "done", "undo", "clear_done", "list"],
    { description: "Scratchpad action" },
);
const SEARCH_MODE_SCHEMA = StringEnum(["keyword", "semantic", "deep"], {
    description:
        "Search mode (kept for compatibility; built-in search is always keyword-based)",
    default: "keyword",
});

const MemoryWriteParams = Type.Object({
    target: TARGET_SCHEMA,
    content: Type.String({ description: "Content to write" }),
    mode: Type.Optional(MODE_SCHEMA),
});

const ScratchpadParams = Type.Object({
    action: SCRATCHPAD_ACTION_SCHEMA,
    text: Type.Optional(Type.String({ description: "Text for add/done/undo" })),
});

const MemoryReadParams = Type.Object({
    target: TARGET_WITH_SCRATCHPAD_SCHEMA,
    date: Type.Optional(
        Type.String({
            description: "YYYY-MM-DD for daily target (defaults to today)",
        }),
    ),
});

const MemoryForgetParams = Type.Object({
    match: Type.String({ description: "Substring to match" }),
    target: Type.Optional(TARGET_SCHEMA),
    date: Type.Optional(
        Type.String({ description: "YYYY-MM-DD for daily target" }),
    ),
});

const MemoryRestoreParams = Type.Object({
    recoveryId: Type.String({ description: "UUID of the recovery record" }),
});

const MemorySearchParams = Type.Object({
    query: Type.String({ description: "Search query" }),
    mode: Type.Optional(SEARCH_MODE_SCHEMA),
    limit: Type.Optional(
        Type.Number({ description: "Max results (1-25)", default: 5 }),
    ),
});

const MemoryStatusParams = Type.Object({});

function getTimestampAndSid(ctx: ExtensionToolContext): {
    timestamp: string;
    sid8: string;
} {
    const timestamp = nowTimestamp();
    const sid8 = shortSessionId(ctx.sessionManager.getSessionId());
    return { timestamp, sid8 };
}

function preview(text: string, maxChars = 2000): string {
    const trimmed = text.trim();
    if (trimmed.length <= maxChars) return trimmed;
    return `${trimmed.slice(0, maxChars)}\n[preview truncated]`;
}

function textResult(text: string, details: unknown, isError = false) {
    return {
        content: [{ type: "text" as const, text }],
        details,
        isError,
    };
}

export interface MemoryToolsDependencies {
    paths: MemoryPaths;
    config: MemoryConfig;
    snapshot: SnapshotState;
    search: SearchBackend;
}

export function buildMemoryTools(
    deps: MemoryToolsDependencies,
): ToolDefinition[] {
    const { paths, config, snapshot, search } = deps;

    async function refreshSearch(): Promise<void> {
        try {
            await search.build(paths);
        } catch {
            // ignore search index errors so tool results are not affected
        }
    }

    const memoryWrite: ToolDefinition<typeof MemoryWriteParams> = {
        name: "memory_write",
        label: "Memory Write",
        description:
            "Write durable memory. target: long_term (MEMORY.md) or daily (today's log). mode append/overwrite for long_term.",
        parameters: MemoryWriteParams,
        async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
            const { timestamp, sid8 } = getTimestampAndSid(ctx);
            const lines = params.content.split("\n");

            if (params.target === "daily") {
                await appendDailyEntry(
                    paths,
                    todayStr(),
                    timestamp,
                    sid8,
                    lines,
                );
                const file = join(paths.daily, `${todayStr()}.md`);
                await refreshSearch();
                const content = await readMemoryFile(file);
                return textResult(
                    `Appended to daily log.\n\n${preview(content)}`,
                    {
                        path: file,
                        target: "daily",
                        sessionId: sid8,
                        timestamp,
                    },
                );
            }

            if (params.mode === "overwrite") {
                await overwriteLongTermEntry(paths, timestamp, sid8, lines);
            } else {
                await appendLongTermEntry(paths, timestamp, sid8, lines);
            }
            snapshot.markDirty();
            await refreshSearch();
            const content = await readMemoryFile(paths.longTerm);
            return textResult(
                `Wrote to long-term memory.\n\n${preview(content)}`,
                {
                    path: paths.longTerm,
                    target: "long_term",
                    mode: params.mode ?? "append",
                    sessionId: sid8,
                    timestamp,
                },
            );
        },
    };

    const scratchpadTool: ToolDefinition<typeof ScratchpadParams> = {
        name: "scratchpad",
        label: "Scratchpad",
        description:
            "Manage the working scratchpad. Actions: add, done, undo, clear_done, list.",
        parameters: ScratchpadParams,
        async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
            const { timestamp, sid8 } = getTimestampAndSid(ctx);
            const text = await readMemoryFile(paths.scratchpad);
            const parsed = parseScratchpad(text);

            if (params.action === "list") {
                const open = parsed.filter(
                    (l) => l.type === "item" && !l.done,
                ).length;
                return textResult(
                    serializeScratchpad(parsed) || "(empty scratchpad)",
                    { count: parsed.length, open, preview: preview(text) },
                );
            }

            if (params.action === "add") {
                if (!params.text) {
                    return textResult(
                        "text is required for add",
                        { action: params.action },
                        true,
                    );
                }
                const lines = params.text.split("\n");
                const blocks = lines
                    .filter((line) => line.trim().length > 0)
                    .map((line) => {
                        const marker = `<!-- ${timestamp} [${sid8}] -->`;
                        return `${marker}\n- [ ] ${line}`;
                    });
                const prefix = text.trim().length > 0 ? "\n\n" : "";
                await writeFile(
                    paths.scratchpad,
                    `${text}${prefix}${blocks.join("\n")}\n`,
                    "utf8",
                );
            } else if (params.action === "done") {
                if (!params.text) {
                    return textResult(
                        "text is required for done",
                        { action: params.action },
                        true,
                    );
                }
                const updated = doneScratchpad(parsed, params.text);
                await writeFile(
                    paths.scratchpad,
                    serializeScratchpad(updated),
                    "utf8",
                );
            } else if (params.action === "undo") {
                if (!params.text) {
                    return textResult(
                        "text is required for undo",
                        { action: params.action },
                        true,
                    );
                }
                const updated = undoScratchpad(parsed, params.text);
                await writeFile(
                    paths.scratchpad,
                    serializeScratchpad(updated),
                    "utf8",
                );
            } else if (params.action === "clear_done") {
                const updated = clearDoneScratchpad(parsed);
                await writeFile(
                    paths.scratchpad,
                    serializeScratchpad(updated),
                    "utf8",
                );
            }

            snapshot.markDirty();
            await refreshSearch();
            const updatedText = await readMemoryFile(paths.scratchpad);
            const open = parseScratchpad(updatedText).filter(
                (l) => l.type === "item" && !l.done,
            ).length;
            return textResult(
                `Scratchpad updated.\n\n${preview(updatedText)}`,
                {
                    action: params.action,
                    sessionId: sid8,
                    timestamp,
                    preview: preview(updatedText),
                    open,
                },
            );
        },
    };

    const memoryRead: ToolDefinition<typeof MemoryReadParams> = {
        name: "memory_read",
        label: "Memory Read",
        description:
            "Read MEMORY.md, SCRATCHPAD.md, a daily log, or list all daily logs.",
        parameters: MemoryReadParams,
        async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
            if (params.target === "long_term") {
                const content = await readMemoryFile(paths.longTerm);
                return textResult(content || "(empty)", {
                    path: paths.longTerm,
                });
            }
            if (params.target === "scratchpad") {
                const content = await readMemoryFile(paths.scratchpad);
                return textResult(content || "(empty)", {
                    path: paths.scratchpad,
                });
            }
            if (params.target === "list") {
                const dates = await listDailyFiles(paths);
                const lines = dates.map((d) => `- ${d}`).join("\n");
                return textResult(lines || "(no daily logs)", {
                    count: dates.length,
                    dates,
                });
            }

            const date = params.date ?? todayStr();
            if (!isValidDailyDate(date)) {
                return textResult(`Invalid date: ${date}`, { date }, true);
            }
            const file = join(paths.daily, `${date}.md`);
            const content = await readMemoryFile(file);
            return textResult(content || "(empty)", { path: file, date });
        },
    };

    const memoryForget: ToolDefinition<typeof MemoryForgetParams> = {
        name: "memory_forget",
        label: "Memory Forget",
        description:
            "Remove memory blocks matching a substring. Writes a recovery record first.",
        parameters: MemoryForgetParams,
        async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
            const target = (params.target ?? "long_term") as
                "long_term" | "daily";
            const date = params.date ?? todayStr();
            if (target === "daily" && !isValidDailyDate(date)) {
                return textResult(`Invalid date: ${date}`, { date }, true);
            }
            const file =
                target === "daily"
                    ? join(paths.daily, `${date}.md`)
                    : paths.longTerm;
            const removed = await forgetBlocks(file, params.match);
            if (removed.length === 0) {
                return textResult(`No matching blocks found in ${target}.`, {
                    target,
                    match: params.match,
                    removedCount: 0,
                });
            }
            const record = await writeRecoveryRecord(
                paths,
                target,
                removed,
                target === "daily" ? { date } : undefined,
            );
            snapshot.markDirty();
            await refreshSearch();
            return textResult(
                `Removed ${removed.length} block(s). Recovery ID: ${record.id}`,
                {
                    removedCount: removed.length,
                    recoveryId: record.id,
                    target,
                    removedPreview: preview(removed.join("\n\n")),
                },
            );
        },
    };

    const memoryRestore: ToolDefinition<typeof MemoryRestoreParams> = {
        name: "memory_restore",
        label: "Memory Restore",
        description: "Restore a previously forgotten memory by recovery ID.",
        parameters: MemoryRestoreParams,
        async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
            const result = await restoreRecoveryRecord(
                paths,
                params.recoveryId,
            );
            if (!result.ok) {
                return textResult(
                    result.error,
                    { recoveryId: params.recoveryId },
                    true,
                );
            }
            snapshot.markDirty();
            await refreshSearch();
            return textResult(
                `Restored recovery record ${params.recoveryId}.`,
                { recoveryId: params.recoveryId },
            );
        },
    };

    const memorySearch: ToolDefinition<typeof MemorySearchParams> = {
        name: "memory_search",
        label: "Memory Search",
        description:
            "Search memory files using built-in search. mode is ignored (kept for compatibility).",
        parameters: MemorySearchParams,
        async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
            const limit = clampSearchLimit(params.limit ?? 5);
            await search.build(paths);
            const results = await search.search(params.query, limit);
            if (results.length === 0) {
                return textResult("No matching memories found.", {
                    query: params.query,
                    results: [],
                });
            }
            const blocks = results.map((r, i) => {
                return [
                    `### Result ${i + 1}`,
                    `**File:** ${r.path}`,
                    `**Score:** ${r.score.toFixed(4)}`,
                    r.snippet,
                ].join("\n");
            });
            return textResult(blocks.join("\n\n---\n\n"), {
                query: params.query,
                resultCount: results.length,
                results,
            });
        },
    };

    const memoryStatus: ToolDefinition<typeof MemoryStatusParams> = {
        name: "memory_status",
        label: "Memory Status",
        description:
            "Report memory file inventory, search backend, and config.",
        parameters: MemoryStatusParams,
        async execute(_toolCallId, _params, _signal, _onUpdate, _ctx) {
            const longTerm = await readMemoryFile(paths.longTerm);
            const scratchpadText = await readMemoryFile(paths.scratchpad);
            const scratchpad = parseScratchpad(scratchpadText);
            const open = scratchpad.filter(
                (l) => l.type === "item" && !l.done,
            ).length;
            const total = scratchpad.filter((l) => l.type === "item").length;
            const dailyDates = await listDailyFiles(paths);
            const latest = dailyDates[0];

            const lines = [
                `memory_dir: ${paths.base}`,
                `search: ${search.name}`,
                `MEMORY.md: ${longTerm.length} chars`,
                `scratchpad: ${open} open / ${total} total`,
                `daily logs: ${dailyDates.length}${latest ? ` (latest ${latest})` : ""}`,
                "",
                "Configuration:",
                `PI_MEMORY_DIR=${config.dir}`,
                `PI_MEMORY_SNAPSHOT=${config.snapshot}`,
                `PI_MEMORY_NO_SEARCH=${config.noSearch ? "1" : "unset"}`,
                `PI_MEMORY_SUMMARIZE_TRANSITIONS=${config.summarizeTransitions ? "1" : "unset"}`,
                `PI_MEMORY_EXIT_SUMMARY=${config.exitSummary ? "enabled" : "disabled"}`,
                `PI_MEMORY_EXIT_SUMMARY_MODEL=${config.exitSummaryModel ?? "session model"}`,
                `PI_MEMORY_EXIT_SUMMARY_REASONING_EFFORT=${config.exitSummaryReasoningEffort}`,
                `PI_MEMORY_EXIT_SUMMARY_TIMEOUT_MS=${config.exitSummaryTimeoutMs}`,
                `PI_MEMORY_CONTEXT_MAX_CHARS=${config.contextMaxChars}`,
                `PI_MEMORY_CONTEXT_LONG_TERM_MAX_CHARS=${config.contextLongTermMaxChars}`,
                `PI_MEMORY_CONTEXT_SCRATCHPAD_MAX_CHARS=${config.contextScratchpadMaxChars}`,
                `PI_MEMORY_CONTEXT_DAILY_MAX_CHARS=${config.contextDailyMaxChars}`,
                `PI_MEMORY_CONTEXT_SEARCH_MAX_CHARS=${config.contextSearchMaxChars}`,
            ];
            return textResult(lines.join("\n"), {
                memoryDir: paths.base,
                search: search.name,
                longTermChars: longTerm.length,
                scratchpadOpen: open,
                scratchpadTotal: total,
                dailyCount: dailyDates.length,
                latestDaily: latest,
                config,
            });
        },
    };

    return [
        memoryWrite,
        scratchpadTool,
        memoryRead,
        memoryForget,
        memoryRestore,
        memorySearch,
        memoryStatus,
    ] as ToolDefinition[];
}
