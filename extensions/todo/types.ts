/**
 * Types and schema shared by the todo extension.
 *
 * This module has no runtime logic besides the `TodoParams` schema constant.
 */

import { StringEnum } from "@earendil-works/pi-ai";
import type {
    AgentToolResult,
    Theme,
    ToolRenderResultOptions,
} from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import type { Static } from "typebox";

export const actions = ["list", "add", "toggle", "clear"] as const;

export type Actions = (typeof actions)[number];

export interface Todo {
    id: number;
    text: string;
    done: boolean;
}

export interface TodoDetails {
    action: Actions;
    todos: Todo[];
    nextId: number;
    error?: string;
}

export const TodoParams = Type.Object({
    action: StringEnum(actions),
    text: Type.Optional(Type.String({ description: "Todo text (for add)" })),
    id: Type.Optional(Type.Number({ description: "Todo ID (for toggle)" })),
});

/** Tool arguments as the model sends them. */
export type TodoToolParams = Static<typeof TodoParams>;

/** Tool arguments narrowed to a single action. */
export type TodoActionParams<A extends Actions> = Omit<
    TodoToolParams,
    "action"
> & {
    action: A;
};

/**
 * Result of an action: the text shown to the model plus the state details
 * stored in the session. The registry adds the `action` field.
 */
export type TodoActionOutcome = {
    text: string;
    details: Omit<TodoDetails, "action">;
};

/** One action of the todo tool: how it mutates state and how it renders. */
export interface TodoActionHandler<A extends Actions = Actions> {
    execute(params: TodoActionParams<A>): TodoActionOutcome;
    /**
     * Renders the tool result. Pi also passes a `ToolRenderContext` as 4th
     * argument; handlers ignore it today (no access to tool args or state).
     */
    renderResult(
        result: AgentToolResult<TodoDetails>,
        options: ToolRenderResultOptions,
        theme: Theme,
    ): Component;
}

/** Handler per action, keyed by action name. */
export type TodoHandlerMap = {
    [A in Actions]: TodoActionHandler<A>;
};

/** State held by the in-memory todo manager. */
export type TodoManagerState = {
    todos: Todo[];
    nextId: number;
};

/** In-memory todo list, shared by the handlers and the /todos command. */
export type TodoManager = {
    reset: (resetState?: TodoManagerState) => void;
    list: () => Todo[];
    count: () => number;
    currentId: () => number;
    incrementId: () => number;
    add: (todo: Todo) => void;
};
