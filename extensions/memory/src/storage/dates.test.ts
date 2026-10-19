import { describe, expect, it } from "vitest";
import {
    isValidDailyDate,
    localDateStr,
    MEMORY_ENTRY_META_COMMENT_REGEX,
    nowTimestamp,
    shortSessionId,
    todayStr,
    yesterdayStr,
} from "./dates.ts";

describe("dates", () => {
    it("localDateStr formats a known local date", () => {
        // 2026-02-15 14:30:00 UTC may be a different local date depending on zone.
        // We verify the format and that midnight UTC yields YYYY-MM-DD.
        const d = new Date("2026-02-15T00:00:00Z");
        const s = localDateStr(d);
        expect(s).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("todayStr and yesterdayStr are valid daily dates", () => {
        expect(isValidDailyDate(todayStr())).toBe(true);
        expect(isValidDailyDate(yesterdayStr())).toBe(true);
        expect(todayStr()).not.toEqual(yesterdayStr());
    });

    it("nowTimestamp has the expected format", () => {
        const ts = nowTimestamp();
        expect(ts).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });

    it("shortSessionId returns the first 8 characters", () => {
        expect(shortSessionId("abcdef123456")).toBe("abcdef12");
        expect(shortSessionId("short")).toBe("short");
    });

    it("isValidDailyDate accepts real dates and rejects invalid ones", () => {
        expect(isValidDailyDate("2026-02-15")).toBe(true);
        expect(isValidDailyDate("2026-02-29")).toBe(false);
        expect(isValidDailyDate("2024-02-29")).toBe(true); // leap year
        expect(isValidDailyDate("not-a-date")).toBe(false);
        expect(isValidDailyDate("2026/02/15")).toBe(false);
        expect(isValidDailyDate("")).toBe(false);
    });

    it("MEMORY_ENTRY_META_COMMENT_REGEX matches pi-memory markers", () => {
        const cases = [
            "<!-- 2026-02-15 14:30:00 [a1b2c3d4] -->",
            "<!-- last updated: 2026-02-15 14:30:00 [a1b2c3d4] -->",
            "<!-- HANDOFF 2026-02-15 14:30:00 [a1b2c3d4] -->",
        ];
        for (const line of cases) {
            expect(line.match(MEMORY_ENTRY_META_COMMENT_REGEX)?.[0]).toBe(line);
        }
    });

    it("MEMORY_ENTRY_META_COMMENT_REGEX rejects malformed markers", () => {
        const bad = [
            "<!-- 2026-02-15 14:30:00 -->",
            "<!-- 2026-02-15 14:30:00 [no-bracket> -->",
            "2026-02-15 14:30:00 [a1b2c3d4]",
        ];
        for (const line of bad) {
            expect(MEMORY_ENTRY_META_COMMENT_REGEX.test(line)).toBe(false);
        }
    });
});
