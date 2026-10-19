import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
    BeforeAgentStartEvent,
    ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";
import { loadMemoryConfig } from "./config.ts";
import { ensureDirs } from "./storage/files.ts";
import { todayStr } from "./storage/dates.ts";
import { createSnapshotState } from "./snapshot.ts";
import { Bm25Search } from "./search/bm25.ts";
import {
    generateExitSummary,
    refreshMemorySnapshot,
    registerMemoryHooks,
} from "./hooks.ts";

function fakeCtx(): ExtensionContext {
    return {
        sessionManager: {
            getSessionId: () => "session-abc12345",
            getBranch: () => [],
        },
        modelRegistry: {
            complete: vi.fn().mockResolvedValue({
                content: [
                    {
                        type: "text",
                        text: "### Decisions\n- chose X\n\n### Lessons Learned\nNone.\n\n### Notes\nNone.\n\n### Follow-ups\nNone.",
                    },
                ],
            }),
        },
        model: { provider: "test", id: "test-model" },
    } as unknown as ExtensionContext;
}

describe("hooks", () => {
    it("registers four hooks", () => {
        const pi = { on: vi.fn() };
        const deps = {
            paths: {
                base: "/tmp",
                longTerm: "/tmp/MEMORY.md",
                scratchpad: "/tmp/SCRATCHPAD.md",
                daily: "/tmp/daily",
                recovery: "/tmp/recovery",
            },
            config: loadMemoryConfig(),
            snapshot: createSnapshotState(loadMemoryConfig()),
            search: new Bm25Search(),
        };
        registerMemoryHooks(pi as never, deps);
        const events = pi.on.mock.calls.map((c) => c[0]);
        expect(events).toContain("session_start");
        expect(events).toContain("before_agent_start");
        expect(events).toContain("session_before_compact");
        expect(events).toContain("session_shutdown");
    });

    it("refreshMemorySnapshot builds and caches a block", async () => {
        const dir = await mkdtemp(join(tmpdir(), "memory-hooks-"));
        const paths = await ensureDirs(dir);
        const config = loadMemoryConfig();
        const snapshot = createSnapshotState(config);
        const search = new Bm25Search();
        const ctx = fakeCtx();
        await refreshMemorySnapshot(
            ctx,
            { paths, config, snapshot, search },
            "test",
        );
        expect(snapshot.cached).not.toBeNull();
        expect(snapshot.dirty).toBe(false);
        expect(snapshot.lastBuildDay).toBe(
            new Date().toISOString().slice(0, 10),
        );
    });

    it("generateExitSummary skips short sessions", async () => {
        const dir = await mkdtemp(join(tmpdir(), "memory-exit-"));
        const paths = await ensureDirs(dir);
        const config = loadMemoryConfig();
        const snapshot = createSnapshotState(config);
        const search = new Bm25Search();
        const ctx = fakeCtx();
        await generateExitSummary(
            ctx,
            { paths, config, snapshot, search },
            "quit",
        );
        const { readFile } = await import("node:fs/promises");
        await expect(
            readFile(
                join(
                    paths.daily,
                    `${new Date().toISOString().slice(0, 10)}.md`,
                ),
                "utf8",
            ),
        ).rejects.toThrow(/ENOENT/);
    });

    it("generateExitSummary writes summary for sufficient messages", async () => {
        const dir = await mkdtemp(join(tmpdir(), "memory-exit-"));
        const paths = await ensureDirs(dir);
        const config = loadMemoryConfig();
        const snapshot = createSnapshotState(config);
        const search = new Bm25Search();
        const messages = Array.from({ length: 5 }, (_, i) => ({
            role: i % 2 === 0 ? "user" : "assistant",
            content: [{ type: "text", text: `msg ${i}` }],
        }));
        const ctx = {
            ...fakeCtx(),
            sessionManager: {
                ...fakeCtx().sessionManager,
                getBranch: () =>
                    messages.map((m) => ({ type: "message", message: m })),
            },
        };
        await generateExitSummary(
            ctx as never,
            { paths, config, snapshot, search },
            "quit",
        );
        const content = await (
            await import("node:fs/promises")
        ).readFile(
            join(paths.daily, `${new Date().toISOString().slice(0, 10)}.md`),
            "utf8",
        );
        expect(content).toContain("Session Summary");
        expect(content).toContain("chose X");
    });

    it("before_agent_start injects the memory section", async () => {
        const dir = await mkdtemp(join(tmpdir(), "memory-hooks-inject-"));
        const paths = await ensureDirs(dir);
        const config = loadMemoryConfig();
        const snapshot = createSnapshotState(config);
        const search = new Bm25Search();
        const pi = { on: vi.fn() };
        registerMemoryHooks(pi as never, {
            paths,
            config,
            snapshot,
            search,
        });

        const call = pi.on.mock.calls.find(
            (c) => c[0] === "before_agent_start",
        )!;
        const handler = call[1] as (
            event: BeforeAgentStartEvent,
            ctx: ExtensionContext,
        ) => Promise<void>;
        const event = {
            messageType: "user",
            prompt: "hello",
            systemPromptOptions: { sections: {} },
        } as BeforeAgentStartEvent;
        await handler(event, fakeCtx());

        expect(event.systemPromptOptions.sections.memory).toContain(
            "## Memory",
        );
        expect(event.systemPromptOptions.sections.memory).toContain("# Memory");
    });

    it("stable mode reuses cached block without rebuilding", async () => {
        const dir = await mkdtemp(join(tmpdir(), "memory-hooks-stable-"));
        const paths = await ensureDirs(dir);
        const config = loadMemoryConfig();
        const snapshot = createSnapshotState(config);
        snapshot.mode = "stable";
        snapshot.setCached("cached block", todayStr());
        snapshot.clearDirty();
        const search = new Bm25Search();
        const pi = { on: vi.fn() };
        registerMemoryHooks(pi as never, { paths, config, snapshot, search });

        const call = pi.on.mock.calls.find(
            (c) => c[0] === "before_agent_start",
        )!;
        const handler = call[1] as (
            event: BeforeAgentStartEvent,
            ctx: ExtensionContext,
        ) => Promise<void>;
        const event = {
            messageType: "user",
            prompt: "hello",
            systemPromptOptions: { sections: {} },
        } as BeforeAgentStartEvent;
        await handler(event, fakeCtx());

        expect(event.systemPromptOptions.sections.memory).toBe("cached block");
    });

    it("refresh mode updates the caveat after a write", async () => {
        const dir = await mkdtemp(join(tmpdir(), "memory-hooks-refresh-"));
        const paths = await ensureDirs(dir);
        const config = { ...loadMemoryConfig(), snapshot: "refresh" as const };
        const snapshot = createSnapshotState(config);
        snapshot.setCached("old", todayStr());
        snapshot.clearDirty();
        snapshot.markDirty();
        const search = new Bm25Search();
        const pi = { on: vi.fn() };
        registerMemoryHooks(pi as never, { paths, config, snapshot, search });

        const call = pi.on.mock.calls.find(
            (c) => c[0] === "before_agent_start",
        )!;
        const handler = call[1] as (
            event: BeforeAgentStartEvent,
            ctx: ExtensionContext,
        ) => Promise<void>;
        const event = {
            messageType: "user",
            prompt: "hello",
            systemPromptOptions: { sections: {} },
        } as BeforeAgentStartEvent;
        await handler(event, fakeCtx());

        expect(event.systemPromptOptions.sections.memory).toContain(
            "Snapshot refreshed after write",
        );
    });

    it("rebuilds snapshot on day rollover", async () => {
        const dir = await mkdtemp(join(tmpdir(), "memory-hooks-rollover-"));
        const paths = await ensureDirs(dir);
        const config = loadMemoryConfig();
        const snapshot = createSnapshotState(config);
        snapshot.setCached("old", "2020-01-01");
        snapshot.clearDirty();
        const search = new Bm25Search();
        const pi = { on: vi.fn() };
        registerMemoryHooks(pi as never, { paths, config, snapshot, search });

        const call = pi.on.mock.calls.find(
            (c) => c[0] === "before_agent_start",
        )!;
        const handler = call[1] as (
            event: BeforeAgentStartEvent,
            ctx: ExtensionContext,
        ) => Promise<void>;
        const event = {
            messageType: "user",
            prompt: "hello",
            systemPromptOptions: { sections: {} },
        } as BeforeAgentStartEvent;
        await handler(event, fakeCtx());

        expect(event.systemPromptOptions.sections.memory).not.toBe("old");
        expect(snapshot.lastBuildDay).toBe(todayStr());
    });

    it("session_before_compact appends handoff block", async () => {
        const dir = await mkdtemp(join(tmpdir(), "memory-hooks-compact-"));
        const paths = await ensureDirs(dir);
        await writeFile(paths.scratchpad, "- [ ] handoff item\n", "utf8");
        await writeFile(
            join(paths.daily, `${todayStr()}.md`),
            "<!-- 2026-02-15 10:00:00 [a1b2c3d4] -->\ndaily note\n",
            "utf8",
        );
        const config = loadMemoryConfig();
        const snapshot = createSnapshotState(config);
        const search = new Bm25Search();
        const pi = { on: vi.fn() };
        registerMemoryHooks(pi as never, { paths, config, snapshot, search });

        const call = pi.on.mock.calls.find(
            (c) => c[0] === "session_before_compact",
        )!;
        const handler = call[1] as (
            event: unknown,
            ctx: ExtensionContext,
        ) => Promise<void>;
        await handler({}, fakeCtx());

        const content = await (
            await import("node:fs/promises")
        ).readFile(join(paths.daily, `${todayStr()}.md`), "utf8");
        expect(content).toContain("## Session Handoff");
        expect(content).toContain("handoff item");
        expect(content).toContain("### Recent Daily Notes");
        expect(content).toContain("daily note");
    });

    it("session_shutdown skips transitions unless enabled", async () => {
        const dir = await mkdtemp(join(tmpdir(), "memory-exit-trans-"));
        const paths = await ensureDirs(dir);
        const config = loadMemoryConfig();
        const snapshot = createSnapshotState(config);
        const search = new Bm25Search();
        const messages = Array.from({ length: 5 }, (_, i) => ({
            role: i % 2 === 0 ? "user" : "assistant",
            content: [{ type: "text", text: `msg ${i}` }],
        }));
        const ctx = {
            ...fakeCtx(),
            sessionManager: {
                ...fakeCtx().sessionManager,
                getBranch: () =>
                    messages.map((m) => ({ type: "message", message: m })),
            },
        };

        const pi = { on: vi.fn() };
        registerMemoryHooks(pi as never, { paths, config, snapshot, search });
        const call = pi.on.mock.calls.find((c) => c[0] === "session_shutdown")!;
        const handler = call[1] as (
            event: { reason: string },
            ctx: ExtensionContext,
        ) => Promise<void>;
        await handler({ reason: "reload" }, ctx as never);

        const { readFile } = await import("node:fs/promises");
        await expect(
            readFile(join(paths.daily, `${todayStr()}.md`), "utf8"),
        ).rejects.toThrow(/ENOENT/);
    });

    it("generateExitSummary skips all-None summaries", async () => {
        const dir = await mkdtemp(join(tmpdir(), "memory-exit-none-"));
        const paths = await ensureDirs(dir);
        const config = loadMemoryConfig();
        const snapshot = createSnapshotState(config);
        const search = new Bm25Search();
        const messages = Array.from({ length: 5 }, (_, i) => ({
            role: i % 2 === 0 ? "user" : "assistant",
            content: [{ type: "text", text: `msg ${i}` }],
        }));
        const ctx = {
            ...fakeCtx(),
            modelRegistry: {
                complete: vi.fn().mockResolvedValue({
                    content: [
                        {
                            type: "text",
                            text: "### Decisions\nNone.\n\n### Lessons Learned\nNone.\n\n### Notes\nNone.\n\n### Follow-ups\nNone.",
                        },
                    ],
                }),
            },
            sessionManager: {
                ...fakeCtx().sessionManager,
                getBranch: () =>
                    messages.map((m) => ({ type: "message", message: m })),
            },
        };

        await generateExitSummary(
            ctx as never,
            { paths, config, snapshot, search },
            "quit",
        );

        const { readFile } = await import("node:fs/promises");
        await expect(
            readFile(join(paths.daily, `${todayStr()}.md`), "utf8"),
        ).rejects.toThrow(/ENOENT/);
    });
});
