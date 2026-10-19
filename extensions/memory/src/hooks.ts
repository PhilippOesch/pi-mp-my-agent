import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import type {
    BeforeAgentStartEvent,
    ExtensionAPI,
    ExtensionContext,
    SessionBeforeCompactEvent,
    SessionShutdownEvent,
    SessionStartEvent,
} from "@earendil-works/pi-coding-agent";
import {
    convertToLlm,
    serializeConversation,
} from "@earendil-works/pi-coding-agent";
import { appendFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { MemoryConfig } from "./config.ts";
import { buildMemoryContext } from "./context.ts";
import type { SearchBackend } from "./search/types.ts";
import { ensureDirs, readMemoryFile } from "./storage/files.ts";
import {
    nowTimestamp,
    shortSessionId,
    todayStr,
    yesterdayStr,
} from "./storage/dates.ts";
import {
    parseScratchpad,
    serializeScratchpadOpenItems,
} from "./storage/scratchpad.ts";
import type { MemoryPaths } from "./storage/files.ts";
import type { SnapshotState } from "./snapshot.ts";

const EXIT_SUMMARY_SYSTEM_PROMPT = [
    "You are a session recap assistant.",
    "Read the conversation and extract key decisions, lessons learned, notes, and follow-ups.",
    "Return ONLY markdown in the specified format, without any extra commentary.",
].join("\n");

const EXIT_SUMMARY_MIN_MESSAGES = 4;
const EXIT_SUMMARY_MAX_CHARS = 80_000;

export interface MemoryHooksDependencies {
    paths: MemoryPaths;
    config: MemoryConfig;
    snapshot: SnapshotState;
    search: SearchBackend;
}

function pad2(n: number): string {
    return n.toString().padStart(2, "0");
}

function localTime(): string {
    const d = new Date();
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function shouldSkipExitSummaryForReason(
    reason: SessionShutdownEvent["reason"],
    config: MemoryConfig,
): boolean {
    if (["reload", "new", "resume", "fork"].includes(reason)) {
        return !config.summarizeTransitions;
    }
    return false;
}

function truncateTail(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text;
    return `...[truncated]\n${text.slice(-maxChars)}`;
}

async function buildSnapshotBlock(
    _ctx: ExtensionContext,
    deps: MemoryHooksDependencies,
    prompt?: string,
): Promise<string> {
    const { paths, config, search, snapshot } = deps;

    const scratchpadText = await readMemoryFile(paths.scratchpad);
    const scratchpadOpen = serializeScratchpadOpenItems(
        parseScratchpad(scratchpadText),
    );

    const todayFile = join(paths.daily, `${todayStr()}.md`);
    const today = await readMemoryFile(todayFile);

    const yesterdayFile = join(paths.daily, `${yesterdayStr()}.md`);
    const yesterday = await readMemoryFile(yesterdayFile);

    const longTerm = await readMemoryFile(paths.longTerm);

    let searchResults = "";
    if (config.snapshot === "per-turn" && prompt && !config.noSearch) {
        try {
            await search.build(paths);
            const results = await search.search(prompt, 5);
            searchResults = results
                .map(
                    (r) =>
                        `**${r.path}** (${r.score.toFixed(4)})\n${r.snippet}`,
                )
                .join("\n\n");
        } catch {
            searchResults = "";
        }
    }

    return buildMemoryContext({
        config,
        scratchpad: scratchpadOpen,
        today,
        longTerm,
        yesterday,
        searchResults,
        caveat: snapshot.caveat,
    });
}

function setRefreshCaveat(snapshot: SnapshotState, reason: string): void {
    snapshot.setCaveat(
        `Snapshot ${reason} at ${localTime()}. Use memory_read / memory_search for the authoritative latest state; recent writes may also be visible in tool-call history.`,
    );
}

export async function refreshMemorySnapshot(
    ctx: ExtensionContext,
    deps: MemoryHooksDependencies,
    reason: string,
): Promise<void> {
    const { snapshot } = deps;
    if (snapshot.mode === "refresh") {
        setRefreshCaveat(snapshot, reason);
    } else if (snapshot.mode === "stable") {
        snapshot.setCaveat(
            "Loaded once at session start and not re-read since. Use memory_read / memory_search for the authoritative latest state; anything written this session is in tool-call history.",
        );
    }
    const block = await buildSnapshotBlock(ctx, deps);
    snapshot.setCached(block, todayStr());
    snapshot.clearDirty();
}

export function registerMemoryHooks(
    pi: ExtensionAPI,
    deps: MemoryHooksDependencies,
): void {
    const { paths, config, snapshot, search } = deps;

    pi.on("session_start", async (_event: SessionStartEvent, ctx) => {
        await ensureDirs(paths.base);
        try {
            await search.build(paths);
        } catch {
            // ignore search build errors on startup
        }
        await refreshMemorySnapshot(ctx, deps, "session start");
    });

    pi.on("before_agent_start", async (event: BeforeAgentStartEvent, ctx) => {
        const prompt = event.messageType === "user" ? event.prompt : undefined;
        const today = todayStr();
        const dayRolledOver =
            snapshot.lastBuildDay !== null && snapshot.lastBuildDay !== today;

        const rebuild =
            snapshot.cached === null ||
            snapshot.mode === "per-turn" ||
            snapshot.dirty ||
            dayRolledOver;

        if (snapshot.mode === "stable" && !rebuild) {
            event.systemPromptOptions.sections["memory"] = snapshot.cached!;
            return;
        }

        if (snapshot.mode === "refresh" && rebuild) {
            const reason = snapshot.dirty
                ? "refreshed after write"
                : dayRolledOver
                  ? "day rolled over"
                  : "session start";
            setRefreshCaveat(snapshot, reason);
        }

        const block = await buildSnapshotBlock(ctx, deps, prompt);
        snapshot.setCached(block, today);
        snapshot.clearDirty();
        event.systemPromptOptions.sections["memory"] = block;
    });

    pi.on(
        "session_before_compact",
        async (_event: SessionBeforeCompactEvent, ctx) => {
            const scratchpadText = await readMemoryFile(paths.scratchpad);
            const openItems = serializeScratchpadOpenItems(
                parseScratchpad(scratchpadText),
            );
            const todayFile = join(paths.daily, `${todayStr()}.md`);
            const todayText = await readMemoryFile(todayFile);
            const tail = todayText
                .split("\n")
                .filter((l) => l.trim().length > 0)
                .slice(-15)
                .join("\n");

            if (!openItems && !tail) {
                await refreshMemorySnapshot(ctx, deps, "compaction");
                return;
            }

            const ts = nowTimestamp();
            const sid8 = shortSessionId(ctx.sessionManager.getSessionId());
            const handoff = [
                `<!-- HANDOFF ${ts} [${sid8}] -->`,
                "## Session Handoff",
                openItems ? "### Open Scratchpad\n" + openItems : "",
                tail ? "### Recent Daily Notes\n" + tail : "",
            ]
                .filter(Boolean)
                .join("\n\n");

            await appendFile(todayFile, `\n\n${handoff}\n`, "utf8");
            await refreshMemorySnapshot(ctx, deps, "compaction");
        },
    );

    pi.on("session_shutdown", async (event: SessionShutdownEvent, ctx) => {
        if (!config.exitSummary) return;
        if (shouldSkipExitSummaryForReason(event.reason, config)) return;
        await generateExitSummary(ctx, deps, event.reason);
    });
}

export async function generateExitSummary(
    ctx: ExtensionContext,
    deps: MemoryHooksDependencies,
    reason: SessionShutdownEvent["reason"],
): Promise<void> {
    const { paths } = deps;
    const branch = ctx.sessionManager.getBranch();
    const messages: AgentMessage[] = [];
    for (const entry of branch) {
        if (
            entry.type === "message" &&
            (entry.message.role === "user" ||
                entry.message.role === "assistant" ||
                entry.message.role === "toolResult")
        ) {
            messages.push(entry.message);
        }
    }

    if (messages.length < EXIT_SUMMARY_MIN_MESSAGES) return;

    const llmMessages = convertToLlm(messages);
    const conversationText = truncateTail(
        serializeConversation(llmMessages),
        EXIT_SUMMARY_MAX_CHARS,
    );

    const truncatedNote =
        conversationText.length >= EXIT_SUMMARY_MAX_CHARS
            ? "\n\n[Conversation truncated to fit context window.]"
            : "";

    const userPrompt =
        `Review the conversation and extract important decisions, lessons learned, notes, and follow-ups for a daily log.\n` +
        `Return markdown only with these exact headings:\n` +
        `### Decisions\n` +
        `### Lessons Learned\n` +
        `### Notes\n` +
        `### Follow-ups\n` +
        `Use bullet points under each heading. If there is nothing, write "None.".\n` +
        `${truncatedNote}\n\n` +
        `<conversation>\n${conversationText}\n</conversation>`;

    let model = ctx.model;
    if (deps.config.exitSummaryModel && model) {
        const [provider, ...idParts] = deps.config.exitSummaryModel.split("/");
        const modelId = idParts.join("/");
        const found = ctx.modelRegistry.find(provider!, modelId);
        if (found) model = found;
    }

    if (!model) return;

    const context = {
        systemPrompt: EXIT_SUMMARY_SYSTEM_PROMPT,
        messages: [
            {
                role: "user" as const,
                content: [{ type: "text" as const, text: userPrompt }],
                timestamp: Date.now(),
            },
        ],
    };

    let summary: string | undefined;
    try {
        const response = (await Promise.race([
            ctx.modelRegistry.complete(model, context),
            new Promise<never>((_, reject) =>
                setTimeout(
                    () => reject(new Error("exit summary timeout")),
                    deps.config.exitSummaryTimeoutMs,
                ),
            ),
        ])) as AssistantMessage;
        summary = response.content
            .filter((b) => b.type === "text")
            .map((b) => (b as { text: string }).text)
            .join("");
    } catch {
        summary = undefined;
    }

    if (!summary || isExitSummaryEmpty(summary)) return;

    const ts = nowTimestamp();
    const sid8 = shortSessionId(ctx.sessionManager.getSessionId());
    const entry =
        `<!-- ${ts} [${sid8}] -->\n` +
        `## Session Summary (auto, exit: ${reason})\n\n` +
        `${summary}\n`;

    const todayFile = join(paths.daily, `${todayStr()}.md`);
    const existing = await readMemoryFile(todayFile);
    const prefix = existing.trim().length > 0 ? "\n\n" : "";
    await writeFile(todayFile, `${existing}${prefix}${entry}`, "utf8");
}

function isExitSummaryEmpty(summary: string): boolean {
    const items = summary
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .filter((line) => /^[-*]|^\d+\./.test(line))
        .map((line) => line.replace(/^[-*\d.]\s*/, "").trim());
    if (items.length === 0) return true;
    return items.every((line) => /^none\.?$/i.test(line));
}
