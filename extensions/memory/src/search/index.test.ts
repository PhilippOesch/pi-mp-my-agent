import { describe, expect, it, vi } from "vitest";
import { createSearchBackend } from "./index.ts";

describe("createSearchBackend", () => {
    it("returns a backend", async () => {
        const backend = await createSearchBackend();
        expect(["fts5", "bm25-builtin"]).toContain(backend.name);
    });

    it("selects fts5 when FTS5 is available", async () => {
        vi.spyOn(
            await import("./fts5.ts"),
            "isFts5Available",
        ).mockResolvedValue(true);
        const backend = await createSearchBackend();
        expect(backend.name).toBe("fts5");
    });

    it("selects bm25-builtin when FTS5 is unavailable", async () => {
        vi.spyOn(
            await import("./fts5.ts"),
            "isFts5Available",
        ).mockResolvedValue(false);
        const backend = await createSearchBackend();
        expect(backend.name).toBe("bm25-builtin");
    });
});
