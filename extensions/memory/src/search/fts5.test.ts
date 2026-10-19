import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureDirs } from "../storage/files.ts";
import { Fts5Search, isFts5Available } from "./fts5.ts";

const fts5Available = await isFts5Available();

describe("Fts5Search", () => {
    let dir: string;

    beforeEach(async () => {
        dir = await mkdtemp(join(tmpdir(), "memory-fts5-"));
    });

    afterEach(async () => {
        await import("node:fs/promises").then(({ rm }) =>
            rm(dir, { recursive: true, force: true }),
        );
    });

    it("detects availability", () => {
        expect(typeof fts5Available).toBe("boolean");
    });

    it.skipIf(!fts5Available)(
        "ranks exact matches above unrelated blocks",
        async () => {
            const paths = await ensureDirs(dir);
            await writeFile(
                paths.longTerm,
                "<!-- 2026-02-15 14:30:00 [a1b2c3d4] -->\nauth strategy uses oauth2\n\n<!-- 2026-02-15 14:31:00 [b2c3d4e5] -->\nunrelated note about lunch\n",
                "utf8",
            );
            const search = new Fts5Search();
            await search.build(paths);
            const results = await search.search("oauth2", 5);
            expect(results.length).toBeGreaterThanOrEqual(1);
            expect(results[0]!.snippet).toContain("oauth2");
        },
    );

    it.skipIf(!fts5Available)("boosts tag and link tokens", async () => {
        const paths = await ensureDirs(dir);
        await writeFile(
            paths.longTerm,
            "<!-- 2026-02-15 14:30:00 [a1b2c3d4] -->\nUse #auth for everything\n\n<!-- 2026-02-15 14:31:00 [b2c3d4e5] -->\nauth is a common word in prose auth auth auth\n",
            "utf8",
        );
        const search = new Fts5Search();
        await search.build(paths);
        const results = await search.search("auth", 5);
        expect(results[0]!.snippet).toContain("#auth");
    });

    it.skipIf(!fts5Available)("clamps limit to [1,25]", async () => {
        const paths = await ensureDirs(dir);
        let content = "";
        for (let i = 0; i < 30; i++) {
            content += `<!-- 2026-02-15 14:${String(i).padStart(2, "0")}:00 [id${i}] -->\nkeyword match ${i}\n\n`;
        }
        await writeFile(paths.longTerm, content, "utf8");
        const search = new Fts5Search();
        await search.build(paths);
        const low = await search.search("keyword", 0);
        expect(low.length).toBeGreaterThanOrEqual(1);
        const high = await search.search("keyword", 100);
        expect(high.length).toBeLessThanOrEqual(25);
    });

    it.skipIf(!fts5Available)(
        "includes path and score for each result",
        async () => {
            const paths = await ensureDirs(dir);
            await writeFile(
                paths.longTerm,
                "<!-- 2026-02-15 14:30:00 [a1b2c3d4] -->\nunique term xyzzy\n",
                "utf8",
            );
            const search = new Fts5Search();
            await search.build(paths);
            const results = await search.search("xyzzy", 5);
            expect(results[0]!.path).toBe(paths.longTerm);
            expect(typeof results[0]!.score).toBe("number");
            expect(results[0]!.score).toBeGreaterThan(0);
        },
    );

    it.skipIf(!fts5Available)(
        "matches non-ascii content and queries",
        async () => {
            const paths = await ensureDirs(dir);
            await writeFile(
                paths.longTerm,
                "<!-- 2026-02-15 14:30:00 [a1b2c3d4] -->\nnaïve strategy café\n",
                "utf8",
            );
            const search = new Fts5Search();
            await search.build(paths);
            const results = await search.search("café", 5);
            expect(results.length).toBeGreaterThanOrEqual(1);
            expect(results[0]!.snippet).toContain("café");
        },
    );
});
