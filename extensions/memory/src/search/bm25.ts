import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { MemoryPaths } from "../storage/files.ts";
import { splitMemoryEntries } from "../storage/files.ts";
import type { SearchBackend, SearchResult } from "./types.ts";
import { clampSearchLimit } from "./types.ts";

const K1 = 1.2;
const B = 0.75;
const TAG_LINK_BOOST = 3.0;

function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}_-]+/gu, " ")
        .split(/\s+/)
        .filter((t) => t.length > 0);
}

function extractTagsAndLinks(text: string): string[] {
    const tags: string[] = [];
    const tagMatches = text.matchAll(/#[\p{L}\p{N}_-]+/gu);
    for (const m of tagMatches) tags.push(m[0]!.toLowerCase());
    const linkMatches = text.matchAll(/\[\[([^\]]+)\]\]/g);
    for (const m of linkMatches) {
        tags.push(m[1]!.toLowerCase());
    }
    return tags;
}

interface Document {
    path: string;
    text: string;
    tokens: string[];
    tagLinkTokens: string[];
    length: number;
}

export class Bm25Search implements SearchBackend {
    name = "bm25-builtin" as const;
    private docs: Document[] = [];
    private df: Map<string, number> = new Map();
    private avgLength = 0;

    async build(paths: MemoryPaths): Promise<void> {
        this.docs = [];
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
                const tokens = tokenize(block);
                const tagLinkTokens = [
                    ...tokenize(extractTagsAndLinks(block).join(" ")),
                ];
                this.docs.push({
                    path: file,
                    text: block,
                    tokens,
                    tagLinkTokens,
                    length: tokens.length,
                });
            }
        }

        this.computeStats();
    }

    private computeStats(): void {
        this.df = new Map();
        let totalLength = 0;
        for (const doc of this.docs) {
            totalLength += doc.length;
            const seen = new Set<string>();
            for (const token of doc.tokens) {
                if (!seen.has(token)) {
                    seen.add(token);
                    this.df.set(token, (this.df.get(token) ?? 0) + 1);
                }
            }
            for (const token of doc.tagLinkTokens) {
                if (!seen.has(`tag:${token}`)) {
                    seen.add(`tag:${token}`);
                    this.df.set(
                        `tag:${token}`,
                        (this.df.get(`tag:${token}`) ?? 0) + 1,
                    );
                }
            }
        }
        this.avgLength =
            this.docs.length > 0 ? totalLength / this.docs.length : 0;
    }

    search(query: string, limit: number): SearchResult[] {
        const q = clampSearchLimit(limit);
        const qTokens = tokenize(query);
        if (qTokens.length === 0 || this.docs.length === 0) return [];

        const scores = new Map<number, number>();
        for (let i = 0; i < this.docs.length; i++) {
            const doc = this.docs[i]!;
            let score = 0;
            for (const token of qTokens) {
                score += this.scoreToken(doc, token, false);
                score += this.scoreToken(doc, token, true) * TAG_LINK_BOOST;
            }
            if (score > 0) scores.set(i, score);
        }

        const ranked = Array.from(scores.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, q);

        return ranked.map(([idx, score]) => {
            const doc = this.docs[idx]!;
            return {
                path: doc.path,
                score,
                snippet: doc.text.slice(0, 300),
            };
        });
    }

    private scoreToken(
        doc: Document,
        token: string,
        isTagLink: boolean,
    ): number {
        const key = isTagLink ? `tag:${token}` : token;
        const tokens = isTagLink ? doc.tagLinkTokens : doc.tokens;
        const df = this.df.get(key) ?? 0;
        if (df === 0) return 0;
        const idf = Math.log(1 + (this.docs.length - df + 0.5) / (df + 0.5));
        const tf = tokens.filter((t) => t === token).length;
        if (tf === 0) return 0;
        const denom =
            tf + K1 * (1 - B + B * (doc.length / (this.avgLength || 1)));
        return (idf * tf * (K1 + 1)) / denom;
    }
}
