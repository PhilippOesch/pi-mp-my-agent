import type { MemoryConfig } from "./config.ts";

export interface BuildMemoryContextInput {
    config: MemoryConfig;
    scratchpad: string;
    today: string;
    longTerm: string;
    yesterday: string;
    searchResults: string;
    caveat: string;
}

function truncateStart(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text;
    const marker = "\n[truncated]\n";
    const tail = text.slice(-(maxChars - marker.length));
    return `${marker}${tail}`;
}

function truncateEnd(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text;
    const marker = "\n[truncated]";
    const head = text.slice(0, maxChars - marker.length);
    return `${head}${marker}`;
}

function truncateMiddle(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text;
    const marker = "\n[truncated]\n";
    const keep = Math.max(0, maxChars - marker.length);
    const headLen = Math.floor(keep / 2);
    const tailLen = keep - headLen;
    return `${text.slice(0, headLen)}${marker}${text.slice(-tailLen)}`;
}

type TruncateMode = "start" | "end" | "middle";

function truncate(text: string, maxChars: number, mode: TruncateMode): string {
    if (mode === "start") return truncateStart(text, maxChars);
    if (mode === "middle") return truncateMiddle(text, maxChars);
    return truncateEnd(text, maxChars);
}

interface Section {
    title: string;
    content: string;
    maxChars: number;
    mode: TruncateMode;
}

export function buildMemoryContext(input: BuildMemoryContextInput): string {
    const sections: Section[] = [
        {
            title: "Open Scratchpad",
            content: input.scratchpad,
            maxChars: input.config.contextScratchpadMaxChars,
            mode: "start",
        },
        {
            title: "Today",
            content: input.today,
            maxChars: input.config.contextDailyMaxChars,
            mode: "end",
        },
        {
            title: "Relevant memories",
            content: input.searchResults,
            maxChars: input.config.contextSearchMaxChars,
            mode: "start",
        },
        {
            title: "MEMORY.md",
            content: input.longTerm,
            maxChars: input.config.contextLongTermMaxChars,
            mode: "middle",
        },
        {
            title: "Yesterday",
            content: input.yesterday,
            maxChars: input.config.contextDailyMaxChars,
            mode: "end",
        },
    ];

    const rendered = sections
        .filter((s) => s.content.trim().length > 0)
        .map((s) => {
            const body = truncate(s.content, s.maxChars, s.mode);
            return `## ${s.title}\n${body}`;
        });

    const header = [
        "## Memory",
        input.caveat ? `(${input.caveat})` : "",
        "The following memory files have been loaded. Use the memory_write tool to persist important information.",
        "- Decisions, preferences, and durable facts → MEMORY.md",
        "- Day-to-day notes and running context → daily/<YYYY-MM-DD>.md",
        "- Things to fix later or keep in mind → scratchpad tool",
        "- Use memory_search to find past context across all memory files.",
        "- Use #tags (e.g. #decision, #preference) and [[links]] (e.g. [[auth-strategy]]) in memory content to improve future search recall.",
        '- If someone says "remember this," write it immediately.',
        "",
        "# Memory",
    ]
        .filter((line) => line !== "")
        .join("\n");

    const body = rendered.join("\n\n---\n\n");
    let full = `${header}\n${body}`;

    if (full.length > input.config.contextMaxChars) {
        const marker = `\n[truncated overall context: configured maximum of ${input.config.contextMaxChars} characters reached]`;
        full = `${marker}${full.slice(-(input.config.contextMaxChars - marker.length))}`;
    }

    return full;
}
