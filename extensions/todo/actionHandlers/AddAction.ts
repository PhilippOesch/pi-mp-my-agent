import { AgentToolResult } from "@earendil-works/pi-agent-core";
import {
    ToolRenderResultOptions,
    Theme,
} from "@earendil-works/pi-coding-agent";

import { Component, Text } from "@earendil-works/pi-tui";
import {
    Todo,
    TodoActionHandler,
    TodoActionOutcome,
    TodoActionParams,
    TodoDetails,
} from "../types.ts";
import { TodoManager } from "../todoManager.ts";

export class AddAction implements TodoActionHandler<"add"> {
    constructor(private _todos: TodoManager) {}

    execute(params: TodoActionParams<"add">): TodoActionOutcome {
        if (!params.text) {
            return {
                text: "Error: text required for add",
                details: {
                    todos: this._todos.list(),
                    nextId: this._todos.currentId(),
                    error: "text required",
                },
            };
        }
        const newTodo: Todo = {
            id: this._todos.incrementId(),
            text: params.text,
            done: false,
        };
        this._todos.add(newTodo);
        return {
            text: `Added todo #${newTodo.id}: ${newTodo.text}`,
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
        const todoList = result.details.todos;
        const added = todoList[todoList.length - 1];
        return new Text(
            theme.fg("success", "✓ Added ") +
                theme.fg("accent", `#${added.id}`) +
                " " +
                theme.fg("muted", added.text),
            0,
            0,
        );
    }
}
