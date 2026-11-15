import { describe, vi, Mock, Mocked, it, expect } from "vitest";
import { ActionHandlerRegistry } from "./ActionHandlerRegistry.ts";
import { DefaultTodoManager, TodoManager } from "../todoManager.ts";
import { beforeEach } from "node:test";
import { ListAction } from "./ListAction.ts";
import { Actions } from "../types.ts";
import { AddAction } from "./AddAction.ts";

describe("ActionHandlerRegistry", () => {
    let fakeTodoManager: TodoManager;

    beforeEach(() => {
        fakeTodoManager = {} as TodoManager;
    });

    it("created succesfully", () => {
        const sut = createSut();

        expect(sut).not.toBeFalsy();
    });

    const createSut = () => new ActionHandlerRegistry(fakeTodoManager);

    describe("get", () => {
        it.for([
            { action: "list", expectedType: ListAction },
            { action: "add", expectedType: AddAction },
        ])(
            "get object of type '$expectedType' for action: $action",
            ({ action, expectedType }) => {
                const sut = createSut();

                const instance = sut.get(action as Actions);

                expect(instance).toBeInstanceOf(expectedType);
            },
        );
    });
});
