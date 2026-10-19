import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { MEMORY_ENTRY_META_COMMENT_REGEX } from "./dates.ts";

export interface MemoryPaths {
    base: string;
    longTerm: string;
    scratchpad: string;
    daily: string;
    recovery: string;
}

export async function ensureDirs(base: string): Promise<MemoryPaths> {
    const paths: MemoryPaths = {
        base,
        longTerm: join(base, "MEMORY.md"),
        scratchpad: join(base, "SCRATCHPAD.md"),
        daily: join(base, "daily"),
        recovery: join(base, "recovery"),
    };
    await mkdir(paths.daily, { recursive: true });
    await mkdir(paths.recovery, { recursive: true });
    return paths;
}

export async function readMemoryFile(path: string): Promise<string> {
    try {
        return await readFile(path, "utf8");
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
        throw error;
    }
}

function finalizeEntry(
    current: { marker: string; contentLines: string[] } | null,
): { marker: string; content: string } | null {
    if (!current) return null;
    while (
        current.contentLines.length > 0 &&
        current.contentLines[current.contentLines.length - 1] === ""
    ) {
        current.contentLines.pop();
    }
    return { marker: current.marker, content: current.contentLines.join("\n") };
}

export function splitMemoryEntries(text: string): Array<{
    marker: string;
    content: string;
}> {
    const lines = text.split("\n");
    const entries: Array<{ marker: string; content: string }> = [];
    let current: { marker: string; contentLines: string[] } | null = null;

    for (const line of lines) {
        if (MEMORY_ENTRY_META_COMMENT_REGEX.test(line)) {
            const finalized = finalizeEntry(current);
            if (finalized) entries.push(finalized);
            current = { marker: line, contentLines: [] };
        } else if (current) {
            current.contentLines.push(line);
        }
    }

    const finalized = finalizeEntry(current);
    if (finalized) entries.push(finalized);

    return entries;
}

function formatEntryLines(lines: string[]): string {
    const body = lines.join("\n");
    return body.endsWith("\n") || body === "" ? body : `${body}\n`;
}

function stampedBlock(
    marker: string,
    lines: string[],
    prefixBlankLine: boolean,
): string {
    const body = `${marker}\n${formatEntryLines(lines)}`;
    return prefixBlankLine ? `\n${body}` : body;
}

export async function appendLongTermEntry(
    paths: MemoryPaths,
    timestamp: string,
    sid8: string,
    lines: string[],
): Promise<void> {
    const existing = await readMemoryFile(paths.longTerm);
    const marker = `<!-- ${timestamp} [${sid8}] -->`;
    const block = stampedBlock(marker, lines, existing.trim().length > 0);
    await writeFile(paths.longTerm, `${existing}${block}`, "utf8");
}

export async function overwriteLongTermEntry(
    paths: MemoryPaths,
    timestamp: string,
    sid8: string,
    lines: string[],
): Promise<void> {
    const marker = `<!-- last updated: ${timestamp} [${sid8}] -->`;
    await writeFile(
        paths.longTerm,
        `${marker}\n${formatEntryLines(lines)}`,
        "utf8",
    );
}

export async function appendDailyEntry(
    paths: MemoryPaths,
    date: string,
    timestamp: string,
    sid8: string,
    lines: string[],
): Promise<void> {
    const file = join(paths.daily, `${date}.md`);
    const existing = await readMemoryFile(file);
    const marker = `<!-- ${timestamp} [${sid8}] -->`;
    const block = stampedBlock(marker, lines, existing.trim().length > 0);
    await writeFile(file, `${existing}${block}`, "utf8");
}

export async function listDailyFiles(paths: MemoryPaths): Promise<string[]> {
    let entries: string[];
    try {
        entries = await readdir(paths.daily);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
        throw error;
    }
    return entries
        .filter((f) => f.endsWith(".md"))
        .map((f) => f.slice(0, -3))
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
        .sort()
        .reverse();
}

export async function forgetBlocks(
    filePath: string,
    match: string,
): Promise<string[]> {
    const text = await readMemoryFile(filePath);
    if (!text.trim()) return [];
    const entries = splitMemoryEntries(text);
    const lower = match.toLowerCase();
    const kept: typeof entries = [];
    const removed: string[] = [];

    for (const entry of entries) {
        const searchable = `${entry.marker}\n${entry.content}`.toLowerCase();
        if (searchable.includes(lower)) {
            removed.push(`${entry.marker}\n${entry.content}`);
        } else {
            kept.push(entry);
        }
    }

    if (removed.length === 0) return [];

    const output = kept
        .map((e) => `${e.marker}\n${formatEntryLines(e.content.split("\n"))}`)
        .join("\n");
    await writeFile(filePath, output, "utf8");
    return removed;
}
