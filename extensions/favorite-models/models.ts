import type { Api, Model } from "@earendil-works/pi-ai";

import { classify } from "./tiers.ts";

export function modelKey(model: Model<Api>): string {
    return `${model.provider}/${model.id}`;
}

export function isFavorite(
    favoriteSet: Set<string>,
    model: Model<Api>,
): boolean {
    return favoriteSet.has(modelKey(model));
}

export function searchText(
    model: Pick<Model<Api>, "id" | "provider" | "name">,
): string {
    return `${model.id} ${model.provider} ${model.name} ${classify(model)}`;
}

/**
 * Build the model order shown in the selector.
 *   1. Favorites in stored order (only those still available)
 *   2. Current model (if not already a favorite)
 *   3. Remaining models, sorted by provider then id
 */
export function buildDisplayModels(
    allModels: readonly Model<Api>[],
    favoriteSet: Set<string>,
    currentModel: Model<Api> | undefined,
    favoriteList: readonly string[],
): Model<Api>[] {
    const byKey = new Map<string, Model<Api>>();
    for (const model of allModels) byKey.set(modelKey(model), model);

    const ordered: Model<Api>[] = [];
    const seen = new Set<string>();

    for (const key of favoriteList) {
        const model = byKey.get(key);
        if (model && !seen.has(key)) {
            ordered.push(model);
            seen.add(key);
        }
    }

    if (currentModel && !seen.has(modelKey(currentModel))) {
        ordered.push(currentModel);
        seen.add(modelKey(currentModel));
    }

    const rest = allModels
        .filter((model) => !seen.has(modelKey(model)))
        .slice()
        .sort((a, b) => {
            const byProvider = a.provider.localeCompare(b.provider);
            return byProvider !== 0 ? byProvider : a.id.localeCompare(b.id);
        });

    ordered.push(...rest);
    return ordered;
}
