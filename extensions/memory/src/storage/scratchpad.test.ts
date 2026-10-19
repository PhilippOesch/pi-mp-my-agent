import { describe, expect, it } from "vitest";
import {
    clearDoneScratchpad,
    doneScratchpad,
    parseScratchpad,
    SCRATCHPAD_ITEM_REGEX,
    serializeScratchpad,
    serializeScratchpadOpenItems,
    toggleScratchpadItem,
    undoScratchpad,
} from "./scratchpad.ts";

describe("scratchpad", () => {
    it("SCRATCHPAD_ITEM_REGEX matches items", () => {
        const open = "- [ ] buy milk";
        const done = "- [x] buy eggs";
        expect(open.match(SCRATCHPAD_ITEM_REGEX)?.[1]).toBe(" ");
        expect(open.match(SCRATCHPAD_ITEM_REGEX)?.[2]).toBe("buy milk");
        expect(done.match(SCRATCHPAD_ITEM_REGEX)?.[1]).toBe("x");
    });

    it("parseScratchpad preserves non-checklist lines", () => {
        const text = "# Notes\n- [ ] item\n\nsome freeform text\n- [x] done";
        const parsed = parseScratchpad(text);
        expect(parsed).toHaveLength(5);
        expect(parsed[0]!.type).toBe("raw");
        expect(parsed[0]!.text).toBe("# Notes");
        expect(parsed[1]!.type).toBe("item");
        expect(parsed[2]!.type).toBe("raw");
        expect(parsed[2]!.text).toBe("");
        expect(parsed[3]!.type).toBe("raw");
        expect(parsed[3]!.text).toBe("some freeform text");
        expect(parsed[4]!.type).toBe("item");
        expect((parsed[4] as { done: boolean }).done).toBe(true);
    });

    it("parseScratchpad attaches preceding meta comment", () => {
        const text =
            "<!-- 2026-02-15 14:30:00 [a1b2c3d4] -->\n- [ ] item with meta";
        const parsed = parseScratchpad(text);
        expect(parsed).toHaveLength(1);
        const item = parsed[0] as { meta?: string; text: string };
        expect(item.meta).toContain("2026-02-15 14:30:00");
        expect(item.text).toBe("item with meta");
    });

    it("toggleScratchpadItem flips checked state", () => {
        const lines = parseScratchpad("- [ ] item");
        const toggled = toggleScratchpadItem(lines, "item");
        expect((toggled[0] as { done: boolean }).done).toBe(true);
        const undone = toggleScratchpadItem(toggled, "item");
        expect((undone[0] as { done: boolean }).done).toBe(false);
    });

    it("doneScratchpad and undoScratchpad use substring matching", () => {
        const lines = parseScratchpad("- [ ] buy milk\n- [x] buy eggs");
        const afterDone = doneScratchpad(lines, "milk");
        expect((afterDone[0] as { done: boolean }).done).toBe(true);
        const afterUndo = undoScratchpad(afterDone, "MILK");
        expect((afterUndo[0] as { done: boolean }).done).toBe(false);
    });

    it("clearDoneScratchpad removes done items and their meta", () => {
        const text =
            "<!-- 2026-02-15 14:30:00 [a1b2c3d4] -->\n- [x] done item\n- [ ] open item";
        const lines = parseScratchpad(text);
        const cleared = clearDoneScratchpad(lines);
        expect(cleared).toHaveLength(1);
        expect((cleared[0] as { text: string }).text).toBe("open item");
    });

    it("serializeScratchpadOpenItems emits only open items", () => {
        const text =
            "<!-- 2026-02-15 14:30:00 [a1b2c3d4] -->\n- [x] done\n- [ ] open";
        const lines = parseScratchpad(text);
        const serialized = serializeScratchpadOpenItems(lines);
        expect(serialized).toContain("- [ ] open");
        expect(serialized).not.toContain("done");
    });

    it("serializeScratchpadOpenItems preserves meta comments", () => {
        const text = "<!-- 2026-02-15 14:30:00 [a1b2c3d4] -->\n- [ ] open item";
        const lines = parseScratchpad(text);
        const serialized = serializeScratchpadOpenItems(lines);
        expect(serialized).toContain("<!-- 2026-02-15 14:30:00 [a1b2c3d4] -->");
    });

    it("serializeScratchpad emits a trailing newline", () => {
        const lines = parseScratchpad("- [ ] item one\n- [x] item two");
        const serialized = serializeScratchpad(lines);
        expect(serialized.endsWith("\n")).toBe(true);
    });

    it("serializeScratchpadOpenItems emits a trailing newline", () => {
        const lines = parseScratchpad("- [ ] item one\n- [x] item two");
        const serialized = serializeScratchpadOpenItems(lines);
        expect(serialized.endsWith("\n")).toBe(true);
    });
});
