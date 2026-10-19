import { Bm25Search } from "./bm25.ts";
import { Fts5Search, isFts5Available } from "./fts5.ts";
import type { SearchBackend } from "./types.ts";

export async function createSearchBackend(): Promise<SearchBackend> {
    if (await isFts5Available()) {
        return new Fts5Search();
    }
    return new Bm25Search();
}
