import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureDirs } from "./files.ts";
import {
    readRecoveryRecord,
    restoreRecoveryRecord,
    UUID_V4_REGEX,
    writeRecoveryRecord,
} from "./recovery.ts";

describe("recovery", () => {
    let dir: string;

    beforeEach(async () => {
        dir = await mkdtemp(join(tmpdir(), "memory-recovery-"));
    });

    afterEach(async () => {
        await import("node:fs/promises").then(({ rm }) =>
            rm(dir, { recursive: true, force: true }),
        );
    });

    it("UUID_V4_REGEX validates v4 UUIDs", () => {
        expect(UUID_V4_REGEX.test("a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d")).toBe(
            true,
        );
        expect(UUID_V4_REGEX.test("not-a-uuid")).toBe(false);
        expect(UUID_V4_REGEX.test("a1b2c3d4-e5f6-5a7b-8c9d-0e1f2a3b4c5d")).toBe(
            false,
        ); // version 5
    });

    it("writeRecoveryRecord creates a v1 record with wx", async () => {
        const paths = await ensureDirs(dir);
        const record = await writeRecoveryRecord(paths, "long_term", [
            "removed block",
        ]);
        expect(record.version).toBe(1);
        expect(record.target).toBe("long_term");
        expect(record.removedContent).toEqual(["removed block"]);
        expect(UUID_V4_REGEX.test(record.id)).toBe(true);

        const file = join(paths.recovery, `${record.id}.json`);
        const raw = await readFile(file, "utf8");
        expect(raw).toContain('"version": 1');
    });

    it("writeRecoveryRecord rejects duplicate IDs", async () => {
        const paths = await ensureDirs(dir);
        const record = await writeRecoveryRecord(paths, "long_term", ["x"]);
        const file = join(paths.recovery, `${record.id}.json`);
        await expect(
            writeFile(file, JSON.stringify(record), { flag: "wx" }),
        ).rejects.toThrow(/EEXIST/);
    });

    it("readRecoveryRecord returns null for missing files", async () => {
        const paths = await ensureDirs(dir);
        const found = await readRecoveryRecord(paths, "missing-id");
        expect(found).toBeNull();
    });

    it("restoreRecoveryRecord appends missing entries and marks restoredAt", async () => {
        const paths = await ensureDirs(dir);
        const record = await writeRecoveryRecord(paths, "long_term", [
            "block one",
        ]);
        await restoreRecoveryRecord(paths, record.id);
        const updated = await readRecoveryRecord(paths, record.id);
        expect(updated!.restoredAt).toBeDefined();

        const content = await readFile(paths.longTerm, "utf8");
        expect(content).toContain("block one");
    });

    it("restoreRecoveryRecord is idempotent", async () => {
        const paths = await ensureDirs(dir);
        const record = await writeRecoveryRecord(paths, "long_term", [
            "block one",
        ]);
        await restoreRecoveryRecord(paths, record.id);
        await restoreRecoveryRecord(paths, record.id);
        const content = await readFile(paths.longTerm, "utf8");
        const matches = content.match(/block one/g);
        expect(matches).toHaveLength(1);
    });

    it("restoreRecoveryRecord handles daily target", async () => {
        const paths = await ensureDirs(dir);
        const record = await writeRecoveryRecord(
            paths,
            "daily",
            ["daily note"],
            {
                date: "2026-02-15",
            },
        );
        await restoreRecoveryRecord(paths, record.id);
        const content = await readFile(
            join(paths.daily, "2026-02-15.md"),
            "utf8",
        );
        expect(content).toContain("daily note");
    });

    it("restoreRecoveryRecord appends daily blocks verbatim", async () => {
        const paths = await ensureDirs(dir);
        const originalMarker = "<!-- 2026-02-15 10:00:00 [a1b2c3d4] -->";
        const originalBlock = `${originalMarker}\ndaily note`;
        const record = await writeRecoveryRecord(
            paths,
            "daily",
            [originalBlock],
            {
                date: "2026-02-15",
            },
        );
        await restoreRecoveryRecord(paths, record.id);
        const content = await readFile(
            join(paths.daily, "2026-02-15.md"),
            "utf8",
        );
        expect(content).toContain(originalMarker);
        expect(content).toContain("daily note");
        expect(content).not.toContain("[restored]");
    });

    it("restoreRecoveryRecord returns error for invalid ID", async () => {
        const paths = await ensureDirs(dir);
        const result = await restoreRecoveryRecord(paths, "not-a-uuid");
        expect(result.ok).toBe(false);
    });
});
