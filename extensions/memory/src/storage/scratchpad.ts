export const SCRATCHPAD_ITEM_REGEX = /^- \[([ xX])\] (.+)$/;
const SCRATCHPAD_META_COMMENT_REGEX =
    /^<!-- \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} \[[^\]\r\n]+\] -->$/;

export interface ScratchpadItem {
    type: "item";
    meta?: string;
    done: boolean;
    text: string;
}

export interface ScratchpadRaw {
    type: "raw";
    text: string;
}

export type ScratchpadLine = ScratchpadItem | ScratchpadRaw;

export function parseScratchpad(text: string): ScratchpadLine[] {
    const lines = text.split("\n");
    const result: ScratchpadLine[] = [];
    let pendingMeta: string | undefined;

    for (const line of lines) {
        const match = SCRATCHPAD_ITEM_REGEX.exec(line);
        if (match) {
            result.push({
                type: "item",
                meta: pendingMeta,
                done: match[1]!.toLowerCase() === "x",
                text: match[2]!,
            });
            pendingMeta = undefined;
        } else if (SCRATCHPAD_META_COMMENT_REGEX.test(line)) {
            pendingMeta = line;
        } else {
            result.push({ type: "raw", text: line });
            pendingMeta = undefined;
        }
    }

    return result;
}

export function serializeScratchpad(lines: ScratchpadLine[]): string {
    const out: string[] = [];
    for (const line of lines) {
        if (line.type === "item") {
            if (line.meta) out.push(line.meta);
            out.push(`- [${line.done ? "x" : " "}] ${line.text}`);
        } else {
            out.push(line.text);
        }
    }
    const text = out.join("\n");
    return text.length > 0 ? `${text}\n` : text;
}

export function serializeScratchpadOpenItems(lines: ScratchpadLine[]): string {
    const out: string[] = [];
    for (const line of lines) {
        if (line.type === "item" && !line.done) {
            if (line.meta) out.push(line.meta);
            out.push(`- [ ] ${line.text}`);
        }
    }
    const text = out.join("\n");
    return text.length > 0 ? `${text}\n` : text;
}

function findItemIndex(
    lines: ScratchpadLine[],
    substring: string,
): number | null {
    const lower = substring.toLowerCase();
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.type === "item" && line.text.toLowerCase().includes(lower)) {
            return i;
        }
    }
    return null;
}

export function toggleScratchpadItem(
    lines: ScratchpadLine[],
    substring: string,
): ScratchpadLine[] {
    const idx = findItemIndex(lines, substring);
    if (idx === null) return lines;
    const next = lines.slice();
    const item = next[idx] as ScratchpadItem;
    next[idx] = { ...item, done: !item.done };
    return next;
}

export function doneScratchpad(
    lines: ScratchpadLine[],
    substring: string,
): ScratchpadLine[] {
    const idx = findItemIndex(lines, substring);
    if (idx === null) return lines;
    const next = lines.slice();
    const item = next[idx] as ScratchpadItem;
    next[idx] = { ...item, done: true };
    return next;
}

export function undoScratchpad(
    lines: ScratchpadLine[],
    substring: string,
): ScratchpadLine[] {
    const idx = findItemIndex(lines, substring);
    if (idx === null) return lines;
    const next = lines.slice();
    const item = next[idx] as ScratchpadItem;
    next[idx] = { ...item, done: false };
    return next;
}

export function clearDoneScratchpad(lines: ScratchpadLine[]): ScratchpadLine[] {
    return lines.filter(
        (line) => !(line.type === "item" && line.done),
    ) as ScratchpadLine[];
}
