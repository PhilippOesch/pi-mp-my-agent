export type Todo = {
    id: number;
    text: string;
    done: boolean;
};

/** State held by the in-memory todo manager. */
export type TodoManagerState = {
    todos: Todo[];
    nextId: number;
};

/** In-memory todo list, shared by the handlers and the /todos command. */
export interface TodoManager {
    reset(resetState?: TodoManagerState): void;
    list(): Todo[];
    count(): number;
    currentId(): number;
    incrementId(): number;
    add(todo: Todo): void;
}

export class DefaultTodoManager implements TodoManager {
    private _state: TodoManagerState = { todos: [], nextId: 0 };

    reset(resetState?: TodoManagerState): void {
        this._state.todos = resetState?.todos ?? [];
        this._state.nextId = resetState?.nextId ?? 0;
    }
    list(): Todo[] {
        return [...this._state.todos];
    }
    count(): number {
        return this._state.todos.length;
    }
    currentId(): number {
        return this._state.nextId;
    }
    incrementId(): number {
        return this._state.nextId++;
    }
    add(todo: Todo): void {
        this._state.todos.push(todo);
    }
}
