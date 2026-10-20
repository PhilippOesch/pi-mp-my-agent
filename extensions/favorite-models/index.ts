/**
 * Favorite Models Extension (with integrated cost tiers)
 *
 * Mark often-used models as favorites and pick them from a dedicated selector
 * that lists favorites at the top. Each row in the selector shows the model's
 * cost tier (free/low/mid/high/maxi) and per-1M-token input/output pricing
 * when the provider publishes them. The active model's tier is also kept
 * current in the footer status line via `ctx.ui.setStatus("tier", ...)`.
 *
 * Both features were previously split across two extensions; they were merged
 * here so a single selector is the entry point for picking, favoriting, and
 * judging cost tier at a glance.
 *
 * Storage:
 *   ~/.pi/agent/favorite-models.json
 *   { "version": 1, "favorites": ["provider/modelId", ...] }
 *   Order in the file is the order shown in the Favorites section.
 *
 * Usage:
 *   /fmodel               Open the favorites-first model selector
 *   Ctrl+L                Same selector (replaces the built-in model selector)
 *
 * In the selector (nav mode is the default):
 *   ↑/↓ or Ctrl+N / Ctrl+P   Move selection
 *   Space                Toggle favorite on the selected row
 *   Enter                Switch to the selected model
 *   Ctrl+S               Switch to the selected model and save it as the global default
 *   /                    Enter search mode and filter the list
 *   Esc / Ctrl+C         Cancel
 *
 * In search mode (entered with /):
 *   Any character        Add to the filter (matches id, provider, name,
 *                        tier; Ctrl+N / Ctrl+P are ignored as nav keys)
 *   Backspace            Remove the last filter char
 *   Enter                Switch to the selected model
 *   Esc                  Leave search mode (filter stays applied)
 */

import type {
    ExtensionAPI,
    ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Key } from "@earendil-works/pi-tui";

import { openSelector } from "./selector.ts";
import { loadFavorites, saveFavorites, STORAGE_FILENAME } from "./storage.ts";
import { updateStatus } from "./status.ts";

const SHORTCUT = Key.ctrl("l");

export default function favoriteModelsExtension(pi: ExtensionAPI) {
    let favoriteList: string[] = [];

    pi.on("session_start", (_event, ctx) => {
        favoriteList = loadFavorites();
        updateStatus(ctx);
    });

    pi.on("model_select", (_event, ctx) => {
        updateStatus(ctx);
    });

    async function runSelector(ctx: ExtensionContext): Promise<void> {
        await openSelector(pi, ctx, favoriteList);
    }

    pi.registerCommand("fmodel", {
        description: "Pick a model with favorites and cost tiers shown",
        handler: async (_args, ctx) => {
            await runSelector(ctx);
        },
    });

    pi.registerShortcut(SHORTCUT, {
        description: "Open favorites-first model selector",
        handler: async (ctx) => {
            await runSelector(ctx);
        },
    });

    pi.on("session_shutdown", () => {
        try {
            saveFavorites(favoriteList);
        } catch (error) {
            console.error(`Failed to save ${STORAGE_FILENAME}:`, error);
        }
    });
}
