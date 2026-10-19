import type { MemoryConfig, SnapshotMode } from "./config.ts";

export interface SnapshotState {
    mode: SnapshotMode;
    dirty: boolean;
    cached: string | null;
    lastBuildDay: string | null;
    caveat: string;
    markDirty(reason?: string): void;
    clearDirty(): void;
    setCached(block: string, day: string): void;
    setCaveat(caveat: string): void;
}

export function createSnapshotState(config: MemoryConfig): SnapshotState {
    return {
        mode: config.snapshot,
        dirty: true,
        cached: null,
        lastBuildDay: null,
        caveat: "Loaded once at session start and not re-read since. Use memory_read / memory_search for the authoritative latest state; anything written this session is in tool-call history.",
        markDirty(_reason?: string) {
            this.dirty = true;
        },
        clearDirty() {
            this.dirty = false;
        },
        setCached(block: string, day: string) {
            this.cached = block;
            this.lastBuildDay = day;
        },
        setCaveat(caveat: string) {
            this.caveat = caveat;
        },
    };
}
