import { TodoManager } from "../TodoManager.ts";
import {
    Actions,
    TodoActionHandler,
    TodoHandlerMap,
} from "../types.ts";
import { AddAction } from "./AddAction.ts";
import { ClearAction } from "./ClearAction.ts";
import { ListAction } from "./ListAction.ts";
import { ToggleAction } from "./ToggleAction.ts";

/**
 * Action registry for available todo extension actions.
 */
export class ActionHandlerRegistry {
    private _registry: TodoHandlerMap;

    public constructor(private _todos: TodoManager) {
        this._registry = {
            list: new ListAction(this._todos),
            add: new AddAction(this._todos),
            toggle: new ToggleAction(this._todos),
            clear: new ClearAction(this._todos),
        };
    }

    public get<A extends Actions>(action: A): TodoActionHandler<A> {
        const handler: TodoActionHandler<A> | undefined =
            this._registry[action];
        if (!handler) {
            throw new Error(`Unknown todo action: ${action}`);
        }
        return handler;
    }
}
