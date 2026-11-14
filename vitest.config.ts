import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: [
            "tests/**/*.test.ts",
            "extensions/subagents/src/**/*.test.ts",
            "extensions/memory/src/**/*.test.ts",
        ],
    },
});
