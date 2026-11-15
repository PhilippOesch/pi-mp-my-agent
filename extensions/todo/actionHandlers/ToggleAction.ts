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
import { TodoManager } from "../todoManager.ts";

export class ToggleAction implements TodoActionHandler<"toggle"> {
    constructor(private _todos: TodoManager) {}

    execute(params: TodoActionParams<"toggle">): TodoActionOutcome {
        if (params.id === undefined) {
            return {
                text: "Error: id required for toggle",
                details: {
                    todos: this._todos.list(),
                    nextId: this._todos.currentId(),
                    error: "id required",
                },
            };
        }
        const todo = this._todos.list().find((t) => t.id === params.id);
        if (!todo) {
            return {
                text: `Todo #${params.id} not found`,
                details: {
                    todos: this._todos.list(),
                    nextId: this._todos.currentId(),
                    error: `#${params.id} not found`,
                },
            };
        }
        todo.done = !todo.done;
        return {
            text: `Todo #${todo.id} ${todo.done ? "completed" : "uncompleted"}`,
            details: {
                todos: this._todos.list(),
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
