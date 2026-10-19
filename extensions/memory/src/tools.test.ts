import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionToolContext } from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadMemoryConfig } from "./config.ts";
import { ensureDirs } from "./storage/files.ts";
import { createSnapshotState } from "./snapshot.ts";
import { Bm25Search } from "./search/bm25.ts";
import { buildMemoryTools } from "./tools.ts";

function fakeCtx(): ExtensionToolContext {
    return {
        sessionManager: {
            getSessionId: () => "session-abc12345",
        },
    } as unknown as ExtensionToolContext;
}

describe("tools", () => {
    let dir: string;
    let paths: Awaited<ReturnType<typeof ensureDirs>>;
    let config: ReturnType<typeof loadMemoryConfig>;
    let snapshot: ReturnType<typeof createSnapshotState>;
    let search: Bm25Search;
    let tools: ReturnType<typeof buildMemoryTools>;

    beforeEach(async () => {
        dir = await mkdtemp(join(tmpdir(), "memory-tools-"));
        paths = await ensureDirs(dir);
        config = loadMemoryConfig();
        snapshot = createSnapshotState(config);
        search = new Bm25Search();
        tools = buildMemoryTools({ paths, config, snapshot, search });
    });

    afterEach(async () => {
        await import("node:fs/promises").then(({ rm }) =>
            rm(dir, { recursive: true, force: true }),
        );
    });

    it("registers seven tools", () => {
        const names = tools.map((t) => t.name);
        expect(names).toEqual([
            "memory_write",
            "scratchpad",
            "memory_read",
            "memory_forget",
            "memory_restore",
            "memory_search",
            "memory_status",
        ]);
    });

    it("memory_write appends to long-term", async () => {
        const tool = tools.find((t) => t.name === "memory_write")!;
        const result = await tool.execute(
            "call-1",
            { target: "long_term", content: "remember this" },
            undefined,
            undefined,
            fakeCtx(),
        );
        expect(result.isError).toBeFalsy();
        expect(result.content[0]!.type).toBe("text");
        expect(snapshot.dirty).toBe(true);
    });

    it("memory_write writes daily without dirtying snapshot", async () => {
        snapshot.clearDirty();
        const tool = tools.find((t) => t.name === "memory_write")!;
        await tool.execute(
            "call-2",
            { target: "daily", content: "daily note" },
            undefined,
            undefined,
            fakeCtx(),
        );
        expect(snapshot.dirty).toBe(false);
    });

    it("scratchpad adds items", async () => {
        const tool = tools.find((t) => t.name === "scratchpad")!;
        const result = await tool.execute(
            "call-3",
            { action: "add", text: "buy milk" },
            undefined,
            undefined,
            fakeCtx(),
        );
        expect(result.isError).toBeFalsy();
    });

    it("memory_read returns long-term content", async () => {
        const write = tools.find((t) => t.name === "memory_write")!;
        await write.execute(
            "call-4",
            { target: "long_term", content: "test content" },
            undefined,
            undefined,
            fakeCtx(),
        );
        const read = tools.find((t) => t.name === "memory_read")!;
        const result = await read.execute(
            "call-5",
            { target: "long_term" },
            undefined,
            undefined,
            fakeCtx(),
        );
        expect(result.content[0]!.type).toBe("text");
        expect((result.content[0] as { text: string }).text).toContain(
            "test content",
        );
    });

    it("memory_forget removes blocks and returns recovery id", async () => {
        const write = tools.find((t) => t.name === "memory_write")!;
        await write.execute(
            "call-6",
            { target: "long_term", content: "remove me" },
            undefined,
            undefined,
            fakeCtx(),
        );
        const forget = tools.find((t) => t.name === "memory_forget")!;
        const result = await forget.execute(
            "call-7",
            { match: "remove me" },
            undefined,
            undefined,
            fakeCtx(),
        );
        expect(result.isError).toBeFalsy();
        expect((result.details as { recoveryId: string }).recoveryId).toMatch(
            /^[0-9a-f-]{36}$/i,
        );
        expect(snapshot.dirty).toBe(true);
    });

    it("memory_restore recovers forgotten content", async () => {
        const write = tools.find((t) => t.name === "memory_write")!;
        await write.execute(
            "call-8",
            { target: "long_term", content: "recover me" },
            undefined,
            undefined,
            fakeCtx(),
        );
        const forget = tools.find((t) => t.name === "memory_forget")!;
        const forgot = await forget.execute(
            "call-9",
            { match: "recover me" },
            undefined,
            undefined,
            fakeCtx(),
        );
        const restore = tools.find((t) => t.name === "memory_restore")!;
        const result = await restore.execute(
            "call-10",
            {
                recoveryId: (forgot.details as { recoveryId: string })
                    .recoveryId,
            },
            undefined,
            undefined,
            fakeCtx(),
        );
        expect(result.isError).toBeFalsy();
    });

    it("memory_search returns result blocks", async () => {
        const write = tools.find((t) => t.name === "memory_write")!;
        await write.execute(
            "call-11",
            { target: "long_term", content: "searchable content" },
            undefined,
            undefined,
            fakeCtx(),
        );
        await search.build(paths);
        const searchTool = tools.find((t) => t.name === "memory_search")!;
        const result = await searchTool.execute(
            "call-12",
            { query: "searchable" },
            undefined,
            undefined,
            fakeCtx(),
        );
        expect(result.content[0]!.type).toBe("text");
        expect((result.content[0] as { text: string }).text).toContain(
            "### Result 1",
        );
    });

    it("refreshes the search index after memory_write", async () => {
        const write = tools.find((t) => t.name === "memory_write")!;
        await write.execute(
            "call-search-refresh",
            { target: "long_term", content: "unique searchable phrase" },
            undefined,
            undefined,
            fakeCtx(),
        );
        const searchTool = tools.find((t) => t.name === "memory_search")!;
        const result = await searchTool.execute(
            "call-search-after-write",
            { query: "unique searchable phrase" },
            undefined,
            undefined,
            fakeCtx(),
        );
        expect(result.isError).toBeFalsy();
        expect((result.content[0] as { text: string }).text).toContain(
            "### Result 1",
        );
    });

    it("memory_status reports inventory", async () => {
        const status = tools.find((t) => t.name === "memory_status")!;
        const result = await status.execute(
            "call-13",
            {},
            undefined,
            undefined,
            fakeCtx(),
        );
        const text = (result.content[0] as { text: string }).text;
        expect(text).toContain("memory_dir");
        expect(text).toContain("search:");
    });
});
