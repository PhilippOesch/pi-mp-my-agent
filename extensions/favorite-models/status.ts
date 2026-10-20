import type { Api, Model } from "@earendil-works/pi-ai";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

import { classify, colorTier, formatCost } from "./tiers.ts";

const STATUS_KEY = "tier";

/** Footer status line for the current model: `tier:<tier> <id> · $in/$out`. */
export function renderStatus(model: Pick<Model<Api>, "id" | "cost">): string {
    const tier = classify(model);
    const inputFormatted = formatCost(model.cost?.input);
    const outputFormatted = formatCost(model.cost?.output);

    if (inputFormatted || outputFormatted) {
        return `tier:${colorTier(tier)} ${model.id} · ${inputFormatted || "—"}/${outputFormatted || "—"}`;
    }
    return `tier:${colorTier(tier)} ${model.id}`;
}

export function updateStatus(ctx: ExtensionContext): void {
    if (ctx.model) {
        ctx.ui.setStatus(STATUS_KEY, renderStatus(ctx.model));
    } else {
        ctx.ui.setStatus(STATUS_KEY, undefined);
    }
}
