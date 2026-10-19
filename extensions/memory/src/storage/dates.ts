export const MEMORY_ENTRY_META_COMMENT_REGEX =
    /^<!-- (?:(?:last updated: )?\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}|HANDOFF \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \[[^\]\r\n]+\] -->$/;

function pad2(n: number): string {
    return n.toString().padStart(2, "0");
}

export function localDateStr(d: Date): string {
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function todayStr(): string {
    return localDateStr(new Date());
}

export function yesterdayStr(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return localDateStr(d);
}

export function nowTimestamp(): string {
    const d = new Date();
    return `${localDateStr(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

export function shortSessionId(sessionId: string): string {
    return sessionId.slice(0, 8);
}

export function isValidDailyDate(date: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const [y, m, d] = date.split("-").map(Number);
    const parsed = new Date(y!, m! - 1, d!);
    return (
        parsed.getFullYear() === y &&
        parsed.getMonth() === m! - 1 &&
        parsed.getDate() === d
    );
}
