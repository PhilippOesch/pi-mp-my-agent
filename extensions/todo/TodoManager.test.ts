import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    DefaultTodoManager,
    Todo,
    TodoManager,
    TodoManagerState,
} from "./TodoManager.ts";

describe("DefaultTodoManager", () => {
    it("created without errors", () => {
        const sut = createSut();

        expect(sut).not.toBeFalsy();
    });

    describe("reset", () => {
        it("resets state", () => {
            const sut = createSut({
                todos: [
                    {
                        id: 1,
                        text: "some text",
                        done: false,
                    },
                ],
                nextId: 2,
            });

            sut.reset();

            expect(sut.list()).toEqual([]);
            expect(sut.count()).toBe(0);
            expect(sut.currentId()).toBe(0);
        });
    });

    describe("list", () => {
        it("should return no entries after initialization", () => {
            const sut = createSut();

            expect(sut.list()).toEqual([]);
        });

        it("lists todos", () => {
            const sut = createSut();
            const todos: Todo[] = [
                { done: false, id: 1, text: "1" },
                { done: true, id: 2, text: "2" },
            ];
            sut.add(todos[0]);
            sut.add(todos[1]);

            const res = sut.list();

            expect(res).toEqual(todos);
        });
    });

    describe("count", () => {
        it("should return 0 after initialization", () => {
            const sut = createSut();

            expect(sut.count()).toBe(0);
        });

        it("should return correct count", () => {
            const sut = createSut();
            const todos: Todo[] = [
                { done: false, id: 1, text: "1" },
                { done: true, id: 2, text: "2" },
            ];
            sut.add(todos[0]);
            sut.add(todos[1]);

            const res = sut.count();

            expect(res).toBe(2);
        });
    });

    describe("currentId", () => {
        it("should return 0 after initialization", () => {
            const sut = createSut();

            expect(sut.currentId()).toBe(0);
        });

        it("should return 1 after calling incrementId one time", () => {
            const sut = createSut();

            sut.incrementId();
            const res = sut.currentId();

            expect(res).toBe(1);
        });
    });

    describe("incrementId", () => {
        it("currentId should 1 and result shouldb be 0", () => {
            const sut = createSut();

            const res = sut.incrementId();

            expect(res).toBe(0);
            expect(sut.currentId()).toBe(1);
        });
    });

    const createSut = (state?: TodoManagerState): DefaultTodoManager => {
        const manager = new DefaultTodoManager();
        if (state) {
            manager.reset(state);
        }
        return manager;
    };
});
