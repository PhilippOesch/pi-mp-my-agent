import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    loadFavorites,
    loadTierOverrides,
    saveFavorites,
    storageFilePath,
    STORAGE_FILENAME,
} from "./storage.ts";

describe("favorite-models storage", () => {
    let agentDir: string;
    let previousEnv: string | undefined;

    beforeEach(() => {
        agentDir = mkdtempSync(join(tmpdir(), "favorite-models-test-"));
        previousEnv = process.env.PI_CODING_AGENT_DIR;
        process.env.PI_CODING_AGENT_DIR = agentDir;
    });

    afterEach(() => {
        if (previousEnv === undefined) {
            delete process.env.PI_CODING_AGENT_DIR;
        } else {
            process.env.PI_CODING_AGENT_DIR = previousEnv;
        }
        rmSync(agentDir, { recursive: true, force: true });
    });

    it("roundtrips favorites and tier overrides through save→load", () => {
        saveFavorites(["prov/a", "prov/b"], { "prov/a": "low" });

        expect(loadFavorites()).toEqual(["prov/a", "prov/b"]);
        expect(loadTierOverrides()).toEqual({ "prov/a": "low" });

        const raw = JSON.parse(
            readFileSync(storageFilePath(), "utf-8"),
        ) as Record<string, unknown>;
        expect(raw.version).toBe(1);
        expect(raw.favorites).toEqual(["prov/a", "prov/b"]);
        expect(raw.tierOverrides).toEqual({ "prov/a": "low" });
    });

    it("loads an old-format file (no tierOverrides) with empty overrides", () => {
        writeFileSync(
            storageFilePath(),
            JSON.stringify({
                version: 1,
                favorites: ["prov/legacy"],
            }) + "\n",
            "utf-8",
        );

        expect(loadFavorites()).toEqual(["prov/legacy"]);
        expect(loadTierOverrides()).toEqual({});
    });

    it("returns empty results when the storage file is missing", () => {
        expect(loadFavorites()).toEqual([]);
        expect(loadTierOverrides()).toEqual({});
    });

    it("drops invalid tier values but keeps valid ones", () => {
        writeFileSync(
            storageFilePath(),
            JSON.stringify({
                version: 1,
                favorites: [],
                tierOverrides: {
                    "prov/good": "maxi",
                    "prov/bad": "banana",
                    "prov/worse": 5,
                },
            }) + "\n",
            "utf-8",
        );

        expect(loadTierOverrides()).toEqual({ "prov/good": "maxi" });
    });

    it("returns empty overrides for corrupt JSON", () => {
        writeFileSync(storageFilePath(), "not json at all{", "utf-8");

        expect(loadFavorites()).toEqual([]);
        expect(loadTierOverrides()).toEqual({});
    });

    it("names the storage file favorite-models.json", () => {
        expect(storageFilePath()).toBe(join(agentDir, STORAGE_FILENAME));
    });
});
