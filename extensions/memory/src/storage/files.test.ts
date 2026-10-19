import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
    appendDailyEntry,
    appendLongTermEntry,
    ensureDirs,
    forgetBlocks,
    listDailyFiles,
    overwriteLongTermEntry,
    readMemoryFile,
    splitMemoryEntries,
} from "./files.ts";

describe("files", () => {
    let dir: string;

    beforeEach(async () => {
        dir = await mkdtemp(join(tmpdir(), "memory-files-"));
    });

    afterEach(async () => {
        await import("node:fs/promises").then(({ rm }) =>
            rm(dir, { recursive: true, force: true }),
        );
    });

    it("ensureDirs creates the required directories", async () => {
        const paths = await ensureDirs(dir);
        expect(paths.base).toBe(dir);
        const stat = await import("node:fs/promises").then(({ stat }) =>
            stat(paths.daily),
        );
        expect(stat.isDirectory()).toBe(true);
    });

    it("appendLongTermEntry creates MEMORY.md with stamped block", async () => {
        const paths = await ensureDirs(dir);
        await appendLongTermEntry(paths, "2026-02-15 14:30:00", "a1b2c3d4", [
            "#preference Always use pnpm.",
        ]);
        const content = await readFile(paths.longTerm, "utf8");
        expect(content).toContain("<!-- 2026-02-15 14:30:00 [a1b2c3d4] -->");
        expect(content).toContain("#preference Always use pnpm.");
    });

    it("appendLongTermEntry separates entries with a blank line", async () => {
        const paths = await ensureDirs(dir);
        await appendLongTermEntry(paths, "2026-02-15 14:30:00", "a1b2c3d4", [
            "first",
        ]);
        await appendLongTermEntry(paths, "2026-02-15 14:31:00", "b2c3d4e5", [
            "second",
        ]);
        const content = await readFile(paths.longTerm, "utf8");
        expect(content).toMatch(
            /first\n\n<!-- 2026-02-15 14:31:00 \[b2c3d4e5\] -->\nsecond/,
        );
    });

    it("overwriteLongTermEntry replaces the file", async () => {
        const paths = await ensureDirs(dir);
        await appendLongTermEntry(paths, "2026-02-15 14:30:00", "a1b2c3d4", [
            "old",
        ]);
        await overwriteLongTermEntry(paths, "2026-02-15 14:35:00", "x1y2z3w4", [
            "new",
        ]);
        const content = await readFile(paths.longTerm, "utf8");
        expect(content).toBe(
            "<!-- last updated: 2026-02-15 14:35:00 [x1y2z3w4] -->\nnew\n",
        );
    });

    it("appendDailyEntry writes to daily/<date>.md", async () => {
        const paths = await ensureDirs(dir);
        await appendDailyEntry(
            paths,
            "2026-02-15",
            "2026-02-15 14:30:00",
            "a1b2c3d4",
            ["Daily note."],
        );
        const content = await readFile(
            join(paths.daily, "2026-02-15.md"),
            "utf8",
        );
        expect(content).toContain("<!-- 2026-02-15 14:30:00 [a1b2c3d4] -->");
        expect(content).toContain("Daily note.");
    });

    it("readMemoryFile reads the whole file", async () => {
        const paths = await ensureDirs(dir);
        await writeFile(paths.longTerm, "hello\nworld", "utf8");
        const content = await readMemoryFile(paths.longTerm);
        expect(content).toBe("hello\nworld");
    });

    it("readMemoryFile returns empty string for missing files", async () => {
        await ensureDirs(dir);
        const content = await readMemoryFile(join(dir, "missing.md"));
        expect(content).toBe("");
    });

    it("splitMemoryEntries parses stamped blocks", () => {
        const text =
            "<!-- 2026-02-15 14:30:00 [a1b2c3d4] -->\nfirst\n\n<!-- last updated: 2026-02-15 14:35:00 [x1y2z3w4] -->\nsecond\n";
        const entries = splitMemoryEntries(text);
        expect(entries).toHaveLength(2);
        expect(entries[0]!.marker).toBe(
            "<!-- 2026-02-15 14:30:00 [a1b2c3d4] -->",
        );
        expect(entries[0]!.content).toBe("first");
        expect(entries[1]!.content).toBe("second");
    });

    it("splitMemoryEntries ignores leading blank lines", () => {
        const text = "\n\n<!-- 2026-02-15 14:30:00 [a1b2c3d4] -->\nonly\n";
        const entries = splitMemoryEntries(text);
        expect(entries).toHaveLength(1);
        expect(entries[0]!.content).toBe("only");
    });

    it("listDailyFiles returns dates in reverse order", async () => {
        const paths = await ensureDirs(dir);
        await writeFile(join(paths.daily, "2026-02-14.md"), "old", "utf8");
        await writeFile(join(paths.daily, "2026-02-16.md"), "new", "utf8");
        await writeFile(join(paths.daily, "2026-02-15.md"), "mid", "utf8");
        const dates = await listDailyFiles(paths);
        expect(dates).toEqual(["2026-02-16", "2026-02-15", "2026-02-14"]);
    });

    it("forgetBlocks removes matching entries from MEMORY.md", async () => {
        const paths = await ensureDirs(dir);
        await appendLongTermEntry(paths, "2026-02-15 14:30:00", "a1b2c3d4", [
            "keep me",
        ]);
        await appendLongTermEntry(paths, "2026-02-15 14:31:00", "b2c3d4e5", [
            "remove me",
        ]);
        const removed = await forgetBlocks(paths.longTerm, "remove");
        expect(removed).toHaveLength(1);
        const content = await readFile(paths.longTerm, "utf8");
        expect(content).toContain("keep me");
        expect(content).not.toContain("remove me");
    });

    it("forgetBlocks returns empty array when nothing matches", async () => {
        const paths = await ensureDirs(dir);
        await appendLongTermEntry(paths, "2026-02-15 14:30:00", "a1b2c3d4", [
            "keep me",
        ]);
        const removed = await forgetBlocks(paths.longTerm, "nomatch");
        expect(removed).toHaveLength(0);
    });
});
