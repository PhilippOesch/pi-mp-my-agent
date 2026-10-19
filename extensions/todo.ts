/**
 * Todo Extension - Demonstrates state management via session entries
 *
 * This extension:
 * - Registers a `todo` tool for the LLM to manage todos
 * - Registers a `/todos` command for users to view the list
 *
 * State is stored in tool result details (not external files), which allows
 * proper branching - when you branch, the todo state is automatically
 * correct for that point in history.
 */

import type {
    ExtensionAPI,
    ExtensionContext,
    Theme,
} from "@earendil-works/pi-coding-agent";
import { matchesKey, Text, truncateToWidth } from "@earendil-works/pi-tui";
import { createTodoHandlers, createTodoManager } from "./todo/handlers.ts";
import {
    type Actions,
    type TodoActionHandler,
    type TodoDetails,
    type TodoHandlerMap,
    type TodoManager,
    TodoParams,
} from "./todo/types.ts";

/**
 * UI component for the /todos command
 */
class TodoListComponent {
    private todos: TodoManager;
    private theme: Theme;
    private onClose: () => void;
    private cachedWidth?: number;
    private cachedLines?: string[];

    constructor(todos: TodoManager, theme: Theme, onClose: () => void) {
        this.todos = todos;
        this.theme = theme;
        this.onClose = onClose;
    }

    handleInput(data: string): void {
        if (matchesKey(data, "escape") || matchesKey(data, "ctrl+c")) {
            this.onClose();
        }
    }

    render(width: number): string[] {
        if (this.cachedLines && this.cachedWidth === width) {
            return this.cachedLines;
        }

        const lines: string[] = [];
        const th = this.theme;

        lines.push("");
        const title = th.fg("accent", " Todos ");
        const headerLine =
            th.fg("borderMuted", "─".repeat(3)) +
            title +
            th.fg("borderMuted", "─".repeat(Math.max(0, width - 10)));
        lines.push(truncateToWidth(headerLine, width));
        lines.push("");

        if (this.todos.count() === 0) {
            lines.push(
                truncateToWidth(
                    `  ${th.fg("dim", "No todos yet. Ask the agent to add some!")}`,
                    width,
                ),
            );
        } else {
            const done = this.todos.list().filter((t) => t.done).length;
            const total = this.todos.count();
            lines.push(
                truncateToWidth(
                    `  ${th.fg("muted", `${done}/${total} completed`)}`,
                    width,
                ),
            );
            lines.push("");

            for (const todo of this.todos.list()) {
                const check = todo.done
                    ? th.fg("success", "✓")
                    : th.fg("dim", "○");
                const id = th.fg("accent", `#${todo.id}`);
                const text = todo.done
                    ? th.fg("dim", todo.text)
                    : th.fg("text", todo.text);
                lines.push(truncateToWidth(`  ${check} ${id} ${text}`, width));
            }
        }

        lines.push("");
        lines.push(
            truncateToWidth(
                `  ${th.fg("dim", "Press Escape to close")}`,
                width,
            ),
        );
        lines.push("");

        this.cachedWidth = width;
        this.cachedLines = lines;
        return lines;
    }

    invalidate(): void {
        this.cachedWidth = undefined;
        this.cachedLines = undefined;
    }
}

export default function (pi: ExtensionAPI) {
    const todos: TodoManager = createTodoManager();
    const handlers: TodoHandlerMap = createTodoHandlers(todos);

    /**
     * Look up the handler for an action.
     *
     * The action is validated against the schema before `execute` runs, but
     * `renderResult` dispatches on `details.action`, which comes from session
     * data and may hold an unknown action. Fail with a readable message
     * instead of a TypeError on `undefined`.
     */
    function getHandler<A extends Actions>(action: A): TodoActionHandler<A> {
        const handler: TodoActionHandler<A> | undefined = handlers[action];
        if (!handler) {
            throw new Error(`Unknown todo action: ${action}`);
        }
        return handler;
    }

    /**
     * Reconstruct state from session entries.
     * Scans tool results for this tool and applies them in order.
     */
    const reconstructState = (ctx: ExtensionContext) => {
        todos.reset();

        for (const entry of ctx.sessionManager.getBranch()) {
            if (entry.type !== "message") continue;
            const msg = entry.message;
            if (msg.role !== "toolResult" || msg.toolName !== "todo") continue;

            const details = msg.details as TodoDetails | undefined;
            if (details) {
                todos.reset({
                    ...details,
                });
            }
        }
    };

    // Reconstruct state on session events
    pi.on("session_start", async (_event, ctx) => reconstructState(ctx));
    pi.on("session_tree", async (_event, ctx) => reconstructState(ctx));

    // Register the todo tool for the LLM
    pi.registerTool<typeof TodoParams, TodoDetails>({
        name: "todo",
        label: "Todo",
        description:
            "Manage a todo list. Actions: list, add (text), toggle (id), clear",
        parameters: TodoParams,

        async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
            const { text, details } = getHandler(params.action).execute(params);
            return {
                content: [{ type: "text", text }],
                details: { ...details, action: params.action },
            };
        },

        renderCall(args, theme, _context) {
            let text =
                theme.fg("toolTitle", theme.bold("todo ")) +
                theme.fg("muted", args.action);
            if (args.text) text += ` ${theme.fg("dim", `"${args.text}"`)}`;
            if (args.id !== undefined)
                text += ` ${theme.fg("accent", `#${args.id}`)}`;
            return new Text(text, 0, 0);
        },

        renderResult(result, options, theme, _context) {
            const details = result.details as TodoDetails | undefined;
            if (!details) {
                const text = result.content[0];
                return new Text(text?.type === "text" ? text.text : "", 0, 0);
            }

            if (details.error) {
                return new Text(
                    theme.fg("error", `Error: ${details.error}`),
                    0,
                    0,
                );
            }

            return getHandler(details.action).renderResult(
                result,
                options,
                theme,
            );
        },
    });

    // Register the /todos command for users
    pi.registerCommand("todos", {
        description: "Show all todos on the current branch",
        handler: async (_args, ctx) => {
            if (ctx.mode !== "tui") {
                ctx.ui.notify("/todos requires interactive mode", "error");
                return;
            }

            await ctx.ui.custom<void>((_tui, theme, _kb, done) => {
                return new TodoListComponent(todos, theme, () => done());
            });
        },
    });
}
