import { AgentToolResult } from "@earendil-works/pi-agent-core";
import {
    ToolRenderResultOptions,
    Theme,
} from "@earendil-works/pi-coding-agent";
import { Component } from "@earendil-works/pi-tui";
import { Text } from "@earendil-works/pi-tui";
import {
    TodoActionHandler,
    TodoActionOutcome,
    TodoActionParams,
    TodoDetails,
} from "../types.ts";
import { TodoManager } from "../TodoManager.ts";

/**
 * Action for clearing all current todos.
 */
export class ClearAction implements TodoActionHandler<"clear"> {
    constructor(private _todos: TodoManager) {}

    execute(_: TodoActionParams<"clear">): TodoActionOutcome {
        const count = this._todos.count();
        this._todos.reset();
        return {
            text: `Cleared ${count} todos`,
            details: {
                todos: [],
                nextId: this._todos.currentId(),
            },
        };
    }
    renderResult(
        result: AgentToolResult<TodoDetails>,
        _: ToolRenderResultOptions,
        theme: Theme,
    ): Component {
        const text = result.content[0];
        const msg = text?.type === "text" ? text.text : "";
        return new Text(
            theme.fg("success", "✓ ") + theme.fg("muted", msg),
            0,
            0,
        );
    }
}
