import { beforeEach } from "vitest";
import { resetFs } from "./extensions/shared/testing/fs-mock.ts";

beforeEach(() => {
    resetFs();
});
