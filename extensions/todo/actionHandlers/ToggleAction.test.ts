import { beforeEach, describe, expect, it, vi } from "vitest";
import { DefaultTodoManager, TodoManager } from "../TodoManager.ts";
import { ToggleAction } from "./ToggleAction.ts";

describe("ToggleAction", () => {
    let fakeTodoManager: TodoManager;

    beforeEach(() => {
        fakeTodoManager = new (vi.fn(DefaultTodoManager))();
    });

    it("created without errors", () => {
        const sut = createSut();

        expect(sut).not.toBeFalsy();
    });

    const createSut = () => new ToggleAction(fakeTodoManager);
});
