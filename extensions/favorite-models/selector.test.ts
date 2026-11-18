import type { Api, Model } from "@earendil-works/pi-ai";
import {
    type ExtensionContext,
    initTheme,
} from "@earendil-works/pi-coding-agent";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { MODEL_TIERS, nextTier, type TierOverrides } from "./tiers.ts";

// The selector key handling must not touch the real file system; storage is
// only consulted through the callbacks, which the test replaces with mocks.
vi.mock("./storage.ts", () => ({
    STORAGE_FILENAME: "favorite-models.json",
    loadFavorites: vi.fn(() => []),
    loadTierOverrides: vi.fn(() => ({})),
    saveFavorites: vi.fn(),
    saveDefaultModel: vi.fn(),
    storageFilePath: vi.fn(() => "/agent/favorite-models.json"),
}));

// Import after the vi.mock declaration so the mock applies.
const { createSelector } = await import("./selector.ts");

function makeModel(id: string, provider = "prov"): Model<Api> {
    return {
        id,
        provider,
        name: id,
        cost: {},
    } as unknown as Model<Api>;
}

interface SelectorFixture {
    render: (width: number) => string[];
    handleInput: (data: string) => void;
    onTierChange: () => void;
    onFavoriteChange: () => void;
}

function makeSelector(models: Model<Api>[]): SelectorFixture & {
    tierOverrides: TierOverrides;
} {
    const tierOverrides: TierOverrides = {};
    const onFavoriteChange = vi.fn();
    const onTierChange = vi.fn();
    const selector = createSelector(
        { requestRender: () => {} },
        { model: undefined } as unknown as ExtensionContext,
        models,
        [],
        tierOverrides,
        () => {},
        onFavoriteChange,
        onTierChange,
    );
    return {
        ...selector,
        tierOverrides,
        onFavoriteChange,
        onTierChange,
    };
}

function renderText(fixture: SelectorFixture): string {
    return fixture.render(120).join("\n");
}

describe("selector tier cycling (t key)", () => {
    beforeAll(() => {
        // Rendering the selector's DynamicBorder requires an initialized
        // theme; pick the default theme without the file watcher.
        initTheme("default", false);
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("cycles a hardcoded tier and reports the change", () => {
        const model = makeModel(Object.keys(MODEL_TIERS)[0]!); // hardcoded tier
        const fixture = makeSelector([model]);

        fixture.handleInput("t");

        const expected = nextTier(MODEL_TIERS[model.id]!);
        expect(fixture.tierOverrides[`prov/${model.id}`]).toBe(expected);
        expect(fixture.onTierChange).toHaveBeenCalledTimes(1);
    });

    it("starts at free for a model with unknown tier", () => {
        const model = makeModel("no-tier-for-this-one");
        const fixture = makeSelector([model]);

        fixture.handleInput("t");

        expect(fixture.tierOverrides["prov/no-tier-for-this-one"]).toBe("free");
    });

    it("wraps maxi back to free", () => {
        const model = makeModel("kimi-k3"); // hardcoded maxi
        const fixture = makeSelector([model]);

        fixture.handleInput("t");

        expect(fixture.tierOverrides["prov/kimi-k3"]).toBe("free");
    });

    it("advances from an existing override, not from the map", () => {
        const model = makeModel(Object.keys(MODEL_TIERS)[0]!);
        const fixture = makeSelector([model]);

        fixture.handleInput("t");
        fixture.handleInput("t");

        const hardcoded = MODEL_TIERS[model.id]!;
        expect(fixture.tierOverrides[`prov/${model.id}`]).toBe(
            nextTier(nextTier(hardcoded)),
        );
        expect(fixture.onTierChange).toHaveBeenCalledTimes(2);
    });

    it("re-filters the list because the tier is part of the search text", () => {
        const model = makeModel("kimi-k3"); // hardcoded tier maxi
        const fixture = makeSelector([model]);

        // Enter search mode, filter for the current tier, then leave search
        // mode (the filter stays applied) and cycle the tier away from it.
        fixture.handleInput("/");
        fixture.handleInput("m");
        fixture.handleInput("a");
        fixture.handleInput("x");
        expect(renderText(fixture)).toContain("kimi-k3");

        fixture.handleInput("\x1b"); // Esc leaves search mode, filter stays
        fixture.handleInput("t");

        expect(fixture.tierOverrides["prov/kimi-k3"]).toBe("free");
        expect(renderText(fixture)).toContain("No matching models");
    });

    it("does nothing when the list is empty", () => {
        const fixture = makeSelector([]);

        fixture.handleInput("t");

        expect(fixture.tierOverrides).toEqual({});
        expect(fixture.onTierChange).not.toHaveBeenCalled();
    });

    it("mentions the t key in the nav-mode footer", () => {
        const fixture = makeSelector([makeModel("kimi-k3")]);
        expect(renderText(fixture)).toContain("t tier");
    });
});
