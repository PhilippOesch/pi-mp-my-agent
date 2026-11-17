import { beforeEach, describe, expect, it, vi } from "vitest";
import { readdir } from "node:fs/promises";
import { resetFs, seedFs } from "./fs-mock.ts";

vi.mock(
  "node:fs/promises",
  async () => import("./__mocks__/node:fs/promises.ts"),
);

describe("node:fs/promises mock", () => {
  beforeEach(() => {
    resetFs();
  });

  describe("readdir", () => {
    it("returns direct-child files and directories", async () => {
      seedFs({
        "/project/src/index.ts": "",
        "/project/src/utils/helpers.ts": "",
        "/project/docs/readme.md": "",
      });

      const entries = await readdir("/project");

      expect(entries.sort()).toEqual(["docs", "src"]);
    });

    it("does not expose deeply nested entries", async () => {
      seedFs({
        "/project/src/utils/helpers.ts": "",
      });

      const entries = await readdir("/project");

      expect(entries).toEqual(["src"]);
    });
  });
});
