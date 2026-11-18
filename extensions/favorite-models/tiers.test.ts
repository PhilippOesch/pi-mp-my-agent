import type { Api, Model } from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";

import {
    classify,
    effectiveTier,
    isTier,
    MODEL_TIERS,
    nextTier,
    tierKey,
    type Tier,
    type TierOverrides,
} from "./tiers.ts";

function makeModel(id: string, provider = "prov"): Model<Api> {
    return { id, provider } as unknown as Model<Api>;
}

describe("nextTier", () => {
    it("cycles free → low → mid → high → maxi", () => {
        expect(nextTier("free")).toBe("low");
        expect(nextTier("low")).toBe("mid");
        expect(nextTier("mid")).toBe("high");
        expect(nextTier("high")).toBe("maxi");
    });

    it("wraps maxi back to free", () => {
        expect(nextTier("maxi")).toBe("free");
    });

    it("starts at free for unknown", () => {
        expect(nextTier("unknown")).toBe("free");
    });
});

describe("effectiveTier", () => {
    it("prefers an override over the hardcoded map", () => {
        const model = makeModel(Object.keys(MODEL_TIERS)[0]!);
        const overrides: TierOverrides = { [tierKey(model)]: "maxi" };
        expect(effectiveTier(model, overrides)).toBe("maxi");
    });

    it("falls back to the hardcoded map without an override", () => {
        const [id, tier] = Object.entries(MODEL_TIERS)[0]!;
        const model = makeModel(id);
        expect(effectiveTier(model)).toBe(tier);
        expect(effectiveTier(model, {})).toBe(tier);
    });

    it("returns unknown for unmapped models without an override", () => {
        const model = makeModel("not-in-the-map");
        expect(effectiveTier(model)).toBe("unknown");
    });

    it("keys overrides by provider/id, not bare id", () => {
        const model = makeModel(Object.keys(MODEL_TIERS)[0]!);
        const bareIdOverride: TierOverrides = { [model.id]: "maxi" };
        expect(effectiveTier(model, bareIdOverride)).not.toBe("maxi");
    });
});

describe("classify", () => {
    it("reads the hardcoded map by bare id", () => {
        const [id, tier] = Object.entries(MODEL_TIERS)[0]!;
        expect(classify(makeModel(id))).toBe(tier);
        expect(classify(makeModel("not-in-the-map"))).toBe("unknown");
    });
});

describe("isTier", () => {
    it("accepts every tier and rejects other values", () => {
        const tiers: Tier[] = ["free", "low", "mid", "high", "maxi", "unknown"];
        for (const tier of tiers) {
            expect(isTier(tier)).toBe(true);
        }
        expect(isTier("banana")).toBe(false);
        expect(isTier(5)).toBe(false);
        expect(isTier(undefined)).toBe(false);
    });
});
