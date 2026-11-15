import { beforeEach, describe, expect, it, vi } from "vitest";
import { AddAction } from "./AddAction.ts";
import { DefaultTodoManager, TodoManager } from "../TodoManager.ts";

describe("AddAction", () => {
    let fakeTodoManager: TodoManager;

    beforeEach(() => {
        fakeTodoManager = new (vi.fn(DefaultTodoManager))();
    });

    it("created without errors", () => {
        const sut = createSut();

        expect(sut).not.toBeFalsy();
    });

    const createSut = () => new AddAction(fakeTodoManager);
});
