import type { Api, Model } from "@earendil-works/pi-ai";
import { modelsAreEqual } from "@earendil-works/pi-ai";
import {
    DynamicBorder,
    type ExtensionAPI,
    type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
    Container,
    fuzzyFilter,
    Input,
    Key,
    matchesKey,
    Spacer,
    Text,
} from "@earendil-works/pi-tui";

import {
    buildDisplayModels,
    isFavorite,
    modelKey,
    searchText,
} from "./models.ts";
import {
    saveDefaultModel,
    saveFavorites,
    STORAGE_FILENAME,
} from "./storage.ts";
import { classify, colorTier, formatCost } from "./tiers.ts";

/** How many model rows are shown at once. */
const MAX_VISIBLE = 10;

/** ANSI color escapes used in the selector list. */
const SELECTOR_COLORS = {
    selectedId: "\x1b[36m", // cyan
    reset: "\x1b[0m",
} as const;

/** Outcome reported by the selector when it closes. */
type SelectorResult =
    | { kind: "select"; model: Model<Api>; persist?: boolean }
    | { kind: "cancel" };

/** Everything one open selector instance needs to render and react to input. */
interface SelectorState {
    readonly tui: { requestRender: () => void };
    readonly allModels: readonly Model<Api>[];
    readonly favoriteList: string[];
    readonly favoriteSet: Set<string>;
    readonly currentModel: Model<Api> | undefined;
    readonly onResult: (result: SelectorResult) => void;
    readonly onFavoriteChange: () => void;
    readonly header: Text;
    readonly footer: Text;
    readonly searchInput: Input;
    readonly listContainer: Container;
    displayModels: Model<Api>[];
    filteredModels: Model<Api>[];
    selectedIndex: number;
    searchMode: boolean;
}

/** Recompute the favorites-first order after the favorite list changed. */
function rebuildDisplayModels(state: SelectorState): void {
    state.displayModels = buildDisplayModels(
        state.allModels,
        state.favoriteSet,
        state.currentModel,
        state.favoriteList,
    );
}

/** Show how many favorites exist next to the total model count. */
function applyHeader(state: SelectorState): void {
    const favCount = state.favoriteList.length;
    const total = state.allModels.length;
    const label =
        favCount > 0
            ? `${favCount} favorite${favCount === 1 ? "" : "s"}`
            : "no favorites yet";
    state.header.setText(`  Models: ${label} · ${total} total`);
}

/** Show the key hints for the current mode. */
function renderFooter(state: SelectorState): void {
    if (state.searchMode) {
        state.footer.setText("  Esc exit filter · Enter select");
    } else {
        state.footer.setText(
            "  ↑/↓ move · / filter · Space favorite · Enter select · Ctrl+S set default · Esc cancel",
        );
    }
}

/** Switch between nav mode and search mode (the filter text is kept). */
function setSearchMode(state: SelectorState, active: boolean): void {
    if (state.searchMode === active) {
        state.searchInput.focused = active;
        return;
    }
    state.searchMode = active;
    state.searchInput.focused = active;
    renderFooter(state);
}

/** Render the visible window of model rows plus the section headers. */
function renderList(state: SelectorState): void {
    const { listContainer, filteredModels, selectedIndex, currentModel } =
        state;
    listContainer.clear();

    if (filteredModels.length === 0) {
        listContainer.addChild(new Text("  No matching models", 0, 0));
        return;
    }

    const startIndex = Math.max(
        0,
        Math.min(
            selectedIndex - Math.floor(MAX_VISIBLE / 2),
            filteredModels.length - MAX_VISIBLE,
        ),
    );
    const endIndex = Math.min(startIndex + MAX_VISIBLE, filteredModels.length);

    let lastSection: "favorites" | "all" | null = null;

    for (let i = startIndex; i < endIndex; i++) {
        const model = filteredModels[i];
        if (!model) continue;

        const isFav = isFavorite(state.favoriteSet, model);
        const section: "favorites" | "all" = isFav ? "favorites" : "all";
        if (section !== lastSection) {
            if (lastSection !== null) listContainer.addChild(new Spacer(1));
            const label =
                section === "favorites"
                    ? "  ── Favorites ──"
                    : "  ── All models ──";
            listContainer.addChild(new Text(label, 0, 0));
            lastSection = section;
        }

        const isSelected = i === selectedIndex;
        const isCurrent = modelsAreEqual(currentModel, model);

        const cursor = isSelected ? "→ " : "  ";
        const favMark = isFav ? "★ " : "  ";
        const currentMark = isCurrent ? "✓ " : "  ";
        const tier = classify(model);
        const idText = isSelected
            ? `${SELECTOR_COLORS.selectedId}${model.id}${SELECTOR_COLORS.reset}`
            : model.id;
        const providerText = `[${model.provider}]`;
        const inputFormatted = formatCost(model.cost?.input);
        const outputFormatted = formatCost(model.cost?.output);
        const pricePart =
            inputFormatted || outputFormatted
                ? ` · ${inputFormatted || "—"}/${outputFormatted || "—"}`
                : "";
        const tierText = `· ${colorTier(tier)}${pricePart}`;

        listContainer.addChild(
            new Text(
                `${cursor}${favMark}${currentMark}${idText} ${providerText} ${tierText}`,
                0,
                0,
            ),
        );
    }

    if (startIndex > 0 || endIndex < filteredModels.length) {
        listContainer.addChild(
            new Text(`  (${selectedIndex + 1}/${filteredModels.length})`, 0, 0),
        );
    }
}

/** Move the cursor by `delta` rows, wrapping around at both ends. */
function moveSelection(state: SelectorState, delta: number): void {
    if (state.filteredModels.length === 0) return;
    const next = state.selectedIndex + delta;
    if (next < 0) {
        state.selectedIndex = state.filteredModels.length - 1;
    } else if (next >= state.filteredModels.length) {
        state.selectedIndex = 0;
    } else {
        state.selectedIndex = next;
    }
    renderList(state);
}

/** Add or remove the selected model from the favorites. */
function toggleFavorite(state: SelectorState): void {
    const model = state.filteredModels[state.selectedIndex];
    if (!model) return;
    const key = modelKey(model);
    if (state.favoriteSet.has(key)) {
        state.favoriteSet.delete(key);
    } else {
        state.favoriteSet.add(key);
    }
    // Preserve the relative order of favorites that survived, append newcomers last.
    const previousOrder = new Map(
        state.favoriteList.map((entry, index) => [entry, index]),
    );
    const nextList = Array.from(state.favoriteSet);
    nextList.sort((a, b) => {
        const ai = previousOrder.has(a)
            ? previousOrder.get(a)!
            : Number.MAX_SAFE_INTEGER;
        const bi = previousOrder.has(b)
            ? previousOrder.get(b)!
            : Number.MAX_SAFE_INTEGER;
        return ai - bi;
    });
    state.favoriteList.length = 0;
    state.favoriteList.push(...nextList);
    rebuildDisplayModels(state);
    filterModels(state, state.searchInput.getValue());
    // Keep the cursor on the same model after it (possibly) moved sections.
    state.selectedIndex = Math.max(
        0,
        state.filteredModels.findIndex((m) => modelKey(m) === key),
    );
    applyHeader(state);
    renderList(state);
    state.onFavoriteChange();
}

/** Apply the search query to the display order and reset the cursor. */
function filterModels(state: SelectorState, query: string): void {
    if (!query) {
        state.filteredModels = state.displayModels;
    } else {
        state.filteredModels = fuzzyFilter(
            state.displayModels,
            query,
            searchText,
        );
    }
    if (query) {
        state.selectedIndex = 0;
    } else {
        state.selectedIndex = Math.min(
            state.selectedIndex,
            Math.max(0, state.filteredModels.length - 1),
        );
    }
    renderList(state);
}

/** Handle a keystroke while the filter input is active. */
function handleSearchModeInput(state: SelectorState, data: string): void {
    if (matchesKey(data, Key.escape)) {
        setSearchMode(state, false);
        state.tui.requestRender();
        return;
    }
    if (data === "\x03" /* Ctrl+C */) {
        state.onResult({ kind: "cancel" });
        return;
    }
    // Ctrl+N / Ctrl+P are nav keys; ignore them in search mode so the
    // user can type freely.
    if (matchesKey(data, Key.ctrl("n")) || matchesKey(data, Key.ctrl("p"))) {
        return;
    }
    // Enter is handled by the Input's onSubmit callback below; everything
    // else (chars, backspace, arrows for cursor positioning) goes to it.
    state.searchInput.handleInput(data);
    filterModels(state, state.searchInput.getValue());
    state.tui.requestRender();
}

/** Handle a keystroke while navigating the model list. */
function handleNavModeInput(state: SelectorState, data: string): void {
    // Nav mode: Ctrl+N / Ctrl+P (and arrow keys) move, space toggles
    // favorite, '/' enters search, enter selects, esc cancels. Other keys
    // are ignored so the user can safely type letters without accidentally
    // filtering.
    if (matchesKey(data, Key.up) || matchesKey(data, Key.ctrl("p"))) {
        moveSelection(state, -1);
        state.tui.requestRender();
        return;
    }
    if (matchesKey(data, Key.down) || matchesKey(data, Key.ctrl("n"))) {
        moveSelection(state, 1);
        state.tui.requestRender();
        return;
    }
    if (matchesKey(data, Key.space)) {
        toggleFavorite(state);
        state.tui.requestRender();
        return;
    }
    if (matchesKey(data, Key.enter)) {
        const model = state.filteredModels[state.selectedIndex];
        if (model) state.onResult({ kind: "select", model });
        return;
    }
    if (matchesKey(data, Key.ctrl("s"))) {
        const model = state.filteredModels[state.selectedIndex];
        if (model) state.onResult({ kind: "select", model, persist: true });
        return;
    }
    if (matchesKey(data, Key.escape) || data === "\x03" /* Ctrl+C */) {
        state.onResult({ kind: "cancel" });
        return;
    }
    // Ignore all other keys in nav mode.
}

/** Route a keystroke to the mode that is currently active. */
function handleInput(state: SelectorState, data: string): void {
    // '/' enters search mode from nav mode. In search mode it is a literal
    // filter character and falls through to the input.
    if (data === "/") {
        if (!state.searchMode) {
            setSearchMode(state, true);
            state.tui.requestRender();
            return;
        }
        state.searchInput.handleInput(data);
        filterModels(state, state.searchInput.getValue());
        state.tui.requestRender();
        return;
    }

    if (state.searchMode) {
        handleSearchModeInput(state, data);
        return;
    }

    handleNavModeInput(state, data);
}

/** Build the selector UI and wire up its input handling. */
function createSelector(
    tui: { requestRender: () => void },
    ctx: ExtensionContext,
    allModels: readonly Model<Api>[],
    favoriteList: string[],
    onResult: (result: SelectorResult) => void,
    onFavoriteChange: () => void,
): {
    render: (width: number) => string[];
    invalidate: () => void;
    handleInput: (data: string) => void;
} {
    const currentModel = ctx.model;
    const favoriteSet = new Set(favoriteList);

    const container = new Container();
    container.addChild(new DynamicBorder());
    container.addChild(new Spacer(1));

    const header = new Text("", 0, 0);
    container.addChild(header);
    container.addChild(new Spacer(1));

    const searchInput = new Input({ placeholder: "Press / to filter" });
    searchInput.focused = false;
    container.addChild(searchInput);
    container.addChild(new Spacer(1));

    const listContainer = new Container();
    container.addChild(listContainer);
    container.addChild(new Spacer(1));

    const footer = new Text("", 0, 0);
    container.addChild(footer);
    container.addChild(new DynamicBorder());

    const state: SelectorState = {
        tui,
        allModels,
        favoriteList,
        favoriteSet,
        currentModel,
        onResult,
        onFavoriteChange,
        header,
        footer,
        searchInput,
        listContainer,
        displayModels: [],
        filteredModels: [],
        selectedIndex: 0,
        searchMode: false,
    };
    rebuildDisplayModels(state);
    state.filteredModels = state.displayModels;

    searchInput.onSubmit = () => {
        const model = state.filteredModels[state.selectedIndex];
        if (model) onResult({ kind: "select", model });
    };

    applyHeader(state);
    renderFooter(state);
    filterModels(state, "");

    return {
        render: (width: number) => container.render(width),
        invalidate: () => container.invalidate(),
        handleInput: (data: string) => handleInput(state, data),
    };
}

export async function openSelector(
    pi: ExtensionAPI,
    ctx: ExtensionContext,
    favoriteList: string[],
): Promise<Model<Api> | null> {
    const allModels = ctx.modelRegistry.getAvailable();
    if (allModels.length === 0) {
        ctx.ui.notify("No available models. Run /login first.", "warning");
        return null;
    }

    return new Promise((resolve) => {
        let settled = false;
        const finish = (value: Model<Api> | null) => {
            if (settled) return;
            settled = true;
            resolve(value);
        };

        void ctx.ui.custom<Model<Api> | null>((tui, _theme, _kb, done) => {
            return createSelector(
                tui,
                ctx,
                allModels,
                favoriteList,
                async (result) => {
                    if (result.kind === "cancel") {
                        done(null);
                        finish(null);
                        return;
                    }
                    const success = await pi.setModel(result.model);
                    if (!success) {
                        ctx.ui.notify(
                            `Could not switch to ${modelKey(result.model)}: no credentials`,
                            "error",
                        );
                        done(null);
                        finish(null);
                        return;
                    }
                    const key = modelKey(result.model);
                    if (result.persist) {
                        try {
                            saveDefaultModel(result.model, ctx);
                            ctx.ui.notify(
                                `Switched to ${key} and saved it as the global default.`,
                                "info",
                            );
                        } catch {
                            ctx.ui.notify(
                                `Switched to ${key}, but failed to save it as default.`,
                                "warning",
                            );
                        }
                    } else {
                        ctx.ui.notify(`Switched to ${key}.`, "info");
                    }
                    done(result.model);
                    finish(result.model);
                },
                () => {
                    try {
                        saveFavorites(favoriteList);
                    } catch (error) {
                        ctx.ui.notify(
                            `Failed to save ${STORAGE_FILENAME}: ${String(error)}`,
                            "error",
                        );
                    }
                },
            );
        });
    });
}
