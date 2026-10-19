import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { MemoryPaths } from "./files.ts";
import { readMemoryFile } from "./files.ts";

export const UUID_V4_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type MemoryTarget = "long_term" | "daily";

export interface RecoveryRecord {
    version: 1;
    id: string;
    createdAt: string;
    target: MemoryTarget;
    date?: string;
    removedContent: string[];
    restoredAt?: string;
}

export interface WriteRecoveryOptions {
    date?: string;
}

export async function writeRecoveryRecord(
    paths: MemoryPaths,
    target: MemoryTarget,
    removedContent: string[],
    options: WriteRecoveryOptions = {},
): Promise<RecoveryRecord> {
    const record: RecoveryRecord = {
        version: 1,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        target,
        date: options.date,
        removedContent,
    };
    const file = join(paths.recovery, `${record.id}.json`);
    await writeFile(file, JSON.stringify(record, null, 2) + "\n", {
        flag: "wx",
    });
    return record;
}

export async function readRecoveryRecord(
    paths: MemoryPaths,
    id: string,
): Promise<RecoveryRecord | null> {
    if (!UUID_V4_REGEX.test(id)) return null;
    try {
        const raw = await readFile(join(paths.recovery, `${id}.json`), "utf8");
        return JSON.parse(raw) as RecoveryRecord;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
    }
}

export async function restoreRecoveryRecord(
    paths: MemoryPaths,
    id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!UUID_V4_REGEX.test(id)) {
        return { ok: false, error: "Invalid recovery ID" };
    }
    const record = await readRecoveryRecord(paths, id);
    if (!record) {
        return { ok: false, error: "Recovery record not found" };
    }

    const timestamp = new Date().toISOString();
    if (record.restoredAt) {
        return { ok: true };
    }

    const destination =
        record.target === "daily"
            ? join(paths.daily, `${record.date ?? "unknown"}.md`)
            : paths.longTerm;
    const existing = await readMemoryFile(destination);

    for (const block of record.removedContent) {
        const trimmed = block.trim();
        if (trimmed && !existing.includes(trimmed)) {
            await appendToDestination(paths, record, destination, block);
        }
    }

    record.restoredAt = timestamp;
    await writeFile(
        join(paths.recovery, `${record.id}.json`),
        JSON.stringify(record, null, 2) + "\n",
        "utf8",
    );

    return { ok: true };
}

async function appendToDestination(
    _paths: MemoryPaths,
    _record: RecoveryRecord,
    destination: string,
    block: string,
): Promise<void> {
    const existing = await readMemoryFile(destination);
    const prefix = existing.trim().length > 0 ? "\n" : "";
    await writeFile(destination, `${existing}${prefix}${block}\n`, "utf8");
}
