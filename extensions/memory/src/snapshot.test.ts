import { describe, expect, it } from "vitest";
import { loadMemoryConfig } from "./config.ts";
import { createSnapshotState } from "./snapshot.ts";

describe("snapshot", () => {
    it("starts dirty so the first build runs", () => {
        const cfg = loadMemoryConfig();
        const s = createSnapshotState(cfg);
        expect(s.dirty).toBe(true);
        expect(s.cached).toBeNull();
    });

    it("caches and clears dirty", () => {
        const cfg = loadMemoryConfig();
        const s = createSnapshotState(cfg);
        s.setCached("block", "2026-02-15");
        s.clearDirty();
        expect(s.dirty).toBe(false);
        expect(s.cached).toBe("block");
        expect(s.lastBuildDay).toBe("2026-02-15");
    });

    it("markDirty invalidates cache", () => {
        const cfg = loadMemoryConfig();
        const s = createSnapshotState(cfg);
        s.setCached("block", "2026-02-15");
        s.clearDirty();
        s.markDirty();
        expect(s.dirty).toBe(true);
    });
});
