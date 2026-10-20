import type { Api, Model } from "@earendil-works/pi-ai";

/** Cost tiers from cheapest to most expensive, plus `unknown` for gaps. */
export type Tier = "free" | "low" | "mid" | "high" | "maxi" | "unknown";

/**
 * Hardcoded tier map for opencode-go models.
 *
 * Keys are bare `model.id`s (no provider prefix). If this extension is ever
 * extended to multiple providers, the key shape should become
 * `${provider}/${model.id}` or similar.
 */
export const MODEL_TIERS: Record<string, Tier> = {
    "claude-haiku-5-5": "low",
    "deepseek-v4-flash": "low",
    "deepseek-v4-flash-vision-exp": "low",
    "deepseek-v4-pro": "mid",
    "deepseek-v4.1-flash": "low",
    "glm-5.2": "high",
    "glm-5.3": "high",
    "glm-5.3-flash": "low",
    "gpt-5.6-luna": "mid",
    "gpt-6-luna": "low",
    "grok-4.6": "high",
    "grok-4.7": "high",
    hy3: "low",
    "hy4-preview": "mid",
    "kimi-k2.7-code": "mid",
    "kimi-k3": "maxi",
    "longcat-2.0": "mid",
    "longcat-2.5-preview-free": "free",
    "mimo-v2.5": "low",
    "mimo-v2.5-pro": "mid",
    "mimo-v2.6-flash": "low",
    "mimo-v2.6-pro": "mid",
    "minimax-m2.7": "mid",
    "minimax-m3": "mid",
    "muse-spark-1.2-contributor": "low",
    "muse-spark-1.3-contributor": "low",
    "qwen3.7-plus": "mid",
    "qwen3.8-flash": "low",
    "qwen3.8-max": "high",
    "space-bunny": "low",
    "step-5-preview-free": "free",
};

/**
 * ANSI 256-color escape for each tier label. Picked for dark terminals: every
 * tone clears 4:1 contrast against a typical #1e1e1e background. The literal
 * tier word stays the primary signal; color is reinforcement.
 */
export const TIER_COLORS: Record<Tier, string> = {
    free: "\x1b[38;5;42m", // emerald
    low: "\x1b[38;5;137m", // bronze
    mid: "\x1b[38;5;250m", // silver
    high: "\x1b[38;5;178m", // gold
    maxi: "\x1b[38;5;220m", // bright gold (one rung above high)
    unknown: "\x1b[38;5;244m", // dim gray
};

/** Wrap a tier name in its color escape; the tier word is the colored element. */
export function colorTier(tier: Tier): string {
    return `${TIER_COLORS[tier]}${tier}\x1b[0m`;
}

/** Classify a model into a cost tier by looking up its id in the tier map. */
export function classify(model: Pick<Model<Api>, "id">): Tier {
    return MODEL_TIERS[model.id] ?? "unknown";
}

/**
 * Format a per-1M-token cost for display.
 *
 * Returns an empty string for zero, NaN, or undefined values so subscription
 * providers (which zero out costs at runtime) simply omit pricing.
 */
export function formatCost(value: number | undefined): string {
    if (value === undefined || Number.isNaN(value) || value === 0) {
        return "";
    }
    if (value < 0) {
        console.warn(`[favorite-models] negative cost encountered: ${value}`);
        return "";
    }
    return `$${value.toFixed(2)}`;
}
