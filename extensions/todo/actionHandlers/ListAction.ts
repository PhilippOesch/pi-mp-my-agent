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

export class ListAction implements TodoActionHandler<"list"> {
    constructor(private _todos: TodoManager) {}

    execute(_: TodoActionParams<"list">): TodoActionOutcome {
        return {
            text: this._todos.count()
                ? this._todos
                      .list()
                      .map((t) => `[${t.done ? "x" : " "}] #${t.id}: ${t.text}`)
                      .join("\n")
                : "No todos",
            details: {
                todos: this._todos.list(),
                nextId: this._todos.currentId(),
            },
        };
    }
    renderResult(
        result: AgentToolResult<TodoDetails>,
        { expanded }: ToolRenderResultOptions,
        theme: Theme,
    ): Component {
        const todoList = result.details.todos;

        if (todoList.length === 0) {
            return new Text(theme.fg("dim", "No todos"), 0, 0);
        }
        let listText = theme.fg("muted", `${todoList.length} todo(s):`);
        const display = expanded ? todoList : todoList.slice(0, 5);
        for (const t of display) {
            const check = t.done
                ? theme.fg("success", "✓")
                : theme.fg("dim", "○");
            const itemText = t.done
                ? theme.fg("dim", t.text)
                : theme.fg("muted", t.text);
            listText += `\n${check} ${theme.fg("accent", `#${t.id}`)} ${itemText}`;
        }
        if (!expanded && todoList.length > 5) {
            listText += `\n${theme.fg("dim", `... ${todoList.length - 5} more`)}`;
        }
        return new Text(listText, 0, 0);
    }
}
