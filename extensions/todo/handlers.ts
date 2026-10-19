/**
 * Action handlers for the todo tool.
 *
 * Each handler owns the state mutation for one action and how its result is
 * rendered. The registry in todo.ts only dispatches to them.
 */

import type {
    AgentToolResult,
    Theme,
    ToolRenderResultOptions,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import type {
    Todo,
    TodoActionHandler,
    TodoDetails,
    TodoHandlerMap,
    TodoManager,
    TodoManagerState,
} from "./types.ts";

export function createTodoManager(): TodoManager {
    const state: TodoManagerState = { todos: [], nextId: 0 };

    const reset = (resetState?: TodoManagerState) => {
        state.todos = resetState?.todos ?? [];
        state.nextId = resetState?.nextId ?? 0;
    };

    const currentId = () => {
        return state.nextId;
    };

    const incrementId = () => {
        return state.nextId++;
    };

    const add = (todo: Todo) => {
        state.todos.push(todo);
    };

    const list = () => {
        return [...state.todos];
    };

    const count = () => {
        return state.todos.length;
    };

    return {
        count,
        add,
        reset,
        list,
        currentId,
        incrementId,
    };
}

export function createTodoHandlers(todos: TodoManager): TodoHandlerMap {
    const list: TodoActionHandler<"list"> = {
        execute() {
            return {
                text: todos.count()
                    ? todos
                          .list()
                          .map(
                              (t) =>
                                  `[${t.done ? "x" : " "}] #${t.id}: ${t.text}`,
                          )
                          .join("\n")
                    : "No todos",
                details: {
                    todos: todos.list(),
                    nextId: todos.currentId(),
                },
            };
        },

        renderResult(
            result: AgentToolResult<TodoDetails>,
            { expanded }: ToolRenderResultOptions,
            theme: Theme,
        ) {
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
        },
    };

    const add: TodoActionHandler<"add"> = {
        execute(params) {
            if (!params.text) {
                return {
                    text: "Error: text required for add",
                    details: {
                        todos: todos.list(),
                        nextId: todos.currentId(),
                        error: "text required",
                    },
                };
            }
            const newTodo: Todo = {
                id: todos.incrementId(),
                text: params.text,
                done: false,
            };
            todos.add(newTodo);
            return {
                text: `Added todo #${newTodo.id}: ${newTodo.text}`,
                details: {
                    todos: todos.list(),
                    nextId: todos.currentId(),
                },
            };
        },

        renderResult(
            result: AgentToolResult<TodoDetails>,
            _options: ToolRenderResultOptions,
            theme: Theme,
        ) {
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
        },
    };

    const toggle: TodoActionHandler<"toggle"> = {
        execute(params) {
            if (params.id === undefined) {
                return {
                    text: "Error: id required for toggle",
                    details: {
                        todos: todos.list(),
                        nextId: todos.currentId(),
                        error: "id required",
                    },
                };
            }
            const todo = todos.list().find((t) => t.id === params.id);
            if (!todo) {
                return {
                    text: `Todo #${params.id} not found`,
                    details: {
                        todos: todos.list(),
                        nextId: todos.currentId(),
                        error: `#${params.id} not found`,
                    },
                };
            }
            todo.done = !todo.done;
            return {
                text: `Todo #${todo.id} ${todo.done ? "completed" : "uncompleted"}`,
                details: {
                    todos: todos.list(),
                    nextId: todos.currentId(),
                },
            };
        },

        renderResult(
            result: AgentToolResult<TodoDetails>,
            _options: ToolRenderResultOptions,
            theme: Theme,
        ) {
            const text = result.content[0];
            const msg = text?.type === "text" ? text.text : "";
            return new Text(
                theme.fg("success", "✓ ") + theme.fg("muted", msg),
                0,
                0,
            );
        },
    };

    const clear: TodoActionHandler<"clear"> = {
        execute() {
            const count = todos.count();
            todos.reset();
            return {
                text: `Cleared ${count} todos`,
                details: {
                    todos: [],
                    nextId: todos.currentId(),
                },
            };
        },

        renderResult(
            _result: AgentToolResult<TodoDetails>,
            _options: ToolRenderResultOptions,
            theme: Theme,
        ) {
            return new Text(
                theme.fg("success", "✓ ") +
                    theme.fg("muted", "Cleared all todos"),
                0,
                0,
            );
        },
    };

    return { list, add, toggle, clear };
}
