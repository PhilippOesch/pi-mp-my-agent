import { describe, expect, it, vi } from "vitest";
import register from "./index.ts";

describe("memory extension entry point", () => {
    it("registers seven tools and four hooks", async () => {
        const pi = {
            registerTool: vi.fn(),
            on: vi.fn(),
        };
        await register(pi as never);
        expect(pi.registerTool).toHaveBeenCalledTimes(7);
        expect(pi.on).toHaveBeenCalledTimes(4);
    });
});
