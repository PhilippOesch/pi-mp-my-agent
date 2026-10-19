export interface SearchResult {
    path: string;
    score: number;
    snippet: string;
}

export interface SearchBackend {
    name: "fts5" | "bm25-builtin";
    build(paths: import("../storage/files.ts").MemoryPaths): Promise<void>;
    search(query: string, limit: number): SearchResult[];
}

export function clampSearchLimit(limit: number): number {
    return Math.max(1, Math.min(25, Math.round(limit)));
}
