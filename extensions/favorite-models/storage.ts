import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Api, Model } from "@earendil-works/pi-ai";
import {
    type ExtensionContext,
    getAgentDir,
} from "@earendil-works/pi-coding-agent";

/** Name of the favorites file inside the agent directory. */
export const STORAGE_FILENAME = "favorite-models.json";

const STORAGE_VERSION = 1;

export interface StorageShape {
    version: number;
    favorites: string[];
}

export function storageFilePath(): string {
    return join(getAgentDir(), STORAGE_FILENAME);
}

export function loadFavorites(): string[] {
    const path = storageFilePath();
    if (!existsSync(path)) return [];
    try {
        const parsed = JSON.parse(
            readFileSync(path, "utf-8"),
        ) as Partial<StorageShape>;
        if (!parsed || typeof parsed !== "object") return [];
        const list = Array.isArray(parsed.favorites) ? parsed.favorites : [];
        return list.filter(
            (entry): entry is string => typeof entry === "string",
        );
    } catch {
        return [];
    }
}

export function saveFavorites(favorites: string[]): void {
    const dir = getAgentDir();
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const payload: StorageShape = { version: STORAGE_VERSION, favorites };
    writeFileSync(
        storageFilePath(),
        JSON.stringify(payload, null, 2) + "\n",
        "utf-8",
    );
}

export function saveDefaultModel(
    model: Model<Api>,
    ctx: ExtensionContext,
): void {
    const path = join(getAgentDir(), "settings.json");
    try {
        let settings: Record<string, unknown> = {};
        if (existsSync(path)) {
            settings = JSON.parse(readFileSync(path, "utf-8")) as Record<
                string,
                unknown
            >;
        }
        settings.defaultProvider = model.provider;
        settings.defaultModel = model.id;
        writeFileSync(path, JSON.stringify(settings, null, 2) + "\n", "utf-8");
    } catch (error) {
        ctx.ui.notify(
            `Failed to save default model: ${String(error)}`,
            "error",
        );
        throw error;
    }
}
