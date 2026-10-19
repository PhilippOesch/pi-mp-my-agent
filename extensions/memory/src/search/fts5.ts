import { readFile, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import type { MemoryPaths } from "../storage/files.ts";
import { splitMemoryEntries } from "../storage/files.ts";
import type { SearchBackend, SearchResult } from "./types.ts";
import { clampSearchLimit } from "./types.ts";

let sqliteModule: typeof import("node:sqlite") | null = null;

async function getSqlite(): Promise<typeof import("node:sqlite") | null> {
    if (sqliteModule) return sqliteModule;
    try {
        sqliteModule = await import("node:sqlite");
        return sqliteModule;
    } catch {
        return null;
    }
}

export async function isFts5Available(): Promise<boolean> {
    const sqlite = await getSqlite();
    if (!sqlite) return false;
    try {
        const db = new sqlite.DatabaseSync(":memory:");
        const stmt = db.prepare("PRAGMA compile_options");
        const rows = stmt.all() as Array<{ compile_options: string }>;
        db.close();
        return rows.some((r) => r.compile_options === "ENABLE_FTS5");
    } catch {
        return false;
    }
}

function extractTagsAndLinks(text: string): { tags: string; links: string } {
    const tags = Array.from(text.matchAll(/#[\p{L}\p{N}_-]+/gu))
        .map((m) => m[0]!.slice(1))
        .join(" ");
    const links = Array.from(text.matchAll(/\[\[([^\]]+)\]\]/g))
        .map((m) => m[1]!)
        .join(" ");
    return { tags, links };
}

export class Fts5Search implements SearchBackend {
    name = "fts5" as const;
    private db: import("node:sqlite").DatabaseSync | null = null;
    private indexPath: string | null = null;

    async build(paths: MemoryPaths): Promise<void> {
        const sqlite = await getSqlite();
        if (!sqlite) throw new Error("node:sqlite is not available");

        this.indexPath = join(paths.base, "index.db");
        try {
            await unlink(this.indexPath);
        } catch {
            // ignore missing file
        }

        this.db = new sqlite.DatabaseSync(this.indexPath);
        this.db.exec(
            `CREATE VIRTUAL TABLE IF NOT EXISTS memory USING fts5(
                path,
                marker,
                body,
                tags,
                links,
                tokenize="unicode61 tokenchars '-_'"
            )`,
        );
        this.db.exec("DELETE FROM memory");

        const insert = this.db.prepare(
            "INSERT INTO memory (path, marker, body, tags, links) VALUES (?, ?, ?, ?, ?)",
        );

        const files: string[] = [paths.longTerm, paths.scratchpad];
        try {
            const dailies = await readdir(paths.daily);
            for (const f of dailies) {
                if (f.endsWith(".md")) files.push(join(paths.daily, f));
            }
        } catch {
            // daily dir may not exist
        }

        for (const file of files) {
            let text: string;
            try {
                text = await readFile(file, "utf8");
            } catch {
                continue;
            }
            const entries = splitMemoryEntries(text);
            for (const entry of entries) {
                const block = `${entry.marker}\n${entry.content}`;
                const { tags, links } = extractTagsAndLinks(block);
                insert.run(file, entry.marker, block, tags, links);
            }
        }
    }

    search(query: string, limit: number): SearchResult[] {
        if (!this.db) return [];
        const q = clampSearchLimit(limit);
        const tokens = this.tokenize(query);
        if (tokens.length === 0) return [];
        const escaped = tokens
            .map((t) => `"${t.replace(/"/g, '""')}"`)
            .join(" ");

        const merged = new Map<
            string,
            {
                row: { path: string; body: string; snippet: string | null };
                score: number;
            }
        >();

        this.collectResults(merged, escaped, "body", 1.0, q);
        this.collectResults(merged, escaped, "tags", 5.0, q);
        this.collectResults(merged, escaped, "links", 5.0, q);

        const ranked = Array.from(merged.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, q);

        return ranked.map((item) => ({
            path: item.row.path,
            score: item.score,
            snippet: item.row.snippet ?? item.row.body.slice(0, 300),
        }));
    }

    private tokenize(query: string): string[] {
        return query
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\-_]+/gu, " ")
            .split(/\s+/)
            .filter((t) => t.length > 0);
    }

    private collectResults(
        merged: Map<
            string,
            {
                row: { path: string; body: string; snippet: string | null };
                score: number;
            }
        >,
        matchQuery: string,
        column: "body" | "tags" | "links",
        weight: number,
        limit: number,
    ): void {
        const stmt = this.db!.prepare(
            `SELECT path, marker, body, snippet(memory, 2, '<b>', '</b>', '...', 30) AS snippet,
                bm25(memory) AS rank
             FROM memory
             WHERE ${column} MATCH ?
             ORDER BY rank ASC
             LIMIT ?`,
        );
        const rows = stmt.all(matchQuery, limit) as Array<{
            path: string;
            marker: string;
            body: string;
            snippet: string | null;
            rank: number;
        }>;

        for (const row of rows) {
            const key = `${row.path}\0${row.marker}`;
            const score = -row.rank * weight;
            const existing = merged.get(key);
            if (!existing || existing.score < score) {
                merged.set(key, { row, score });
            } else {
                existing.score += score;
            }
        }
    }
}
