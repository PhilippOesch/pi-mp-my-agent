import type { Api, Model } from "@earendil-works/pi-ai";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

import {
    colorTier,
    effectiveTier,
    formatCost,
    type TierOverrides,
} from "./tiers.ts";

const STATUS_KEY = "tier";

/** Footer status line for the current model: `tier:<tier> <id> · $in/$out`. */
export function renderStatus(
    model: Pick<Model<Api>, "id" | "provider" | "cost">,
    tierOverrides?: TierOverrides,
): string {
    const tier = effectiveTier(model, tierOverrides);
    const inputFormatted = formatCost(model.cost?.input);
    const outputFormatted = formatCost(model.cost?.output);

    if (inputFormatted || outputFormatted) {
        return `tier:${colorTier(tier)} ${model.id} · ${inputFormatted || "—"}/${outputFormatted || "—"}`;
    }
    return `tier:${colorTier(tier)} ${model.id}`;
}

export function updateStatus(
    ctx: ExtensionContext,
    tierOverrides?: TierOverrides,
): void {
    if (ctx.model) {
        ctx.ui.setStatus(STATUS_KEY, renderStatus(ctx.model, tierOverrides));
    } else {
        ctx.ui.setStatus(STATUS_KEY, undefined);
    }
}
