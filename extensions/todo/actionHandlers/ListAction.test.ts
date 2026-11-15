import { beforeEach, describe, expect, it, vi } from "vitest";
import { DefaultTodoManager, TodoManager } from "../TodoManager.ts";
import { ListAction } from "./ListAction.ts";

describe("ListAction", () => {
    let fakeTodoManager: TodoManager;

    beforeEach(() => {
        fakeTodoManager = new (vi.fn(DefaultTodoManager))();
    });

    it("created without errors", () => {
        const sut = createSut();

        expect(sut).not.toBeFalsy();
    });

    const createSut = () => new ListAction(fakeTodoManager);
});
