import {
  __getFsState,
  __resetFs,
  __seedFs,
} from "./__mocks__/node:fs/promises.ts";

/**
 * Test helpers for the in-memory `node:fs/promises` mock.
 *
 * Opt in to the mock by adding this top-level call in a test file:
 *
 *   vi.mock(
 *     "node:fs/promises",
 *     async () => import("./__mocks__/node:fs/promises.ts"),
 *   );
 *
 * Call `resetFs()` in `beforeEach` to keep tests isolated.
 */

export function seedFs(entries: Record<string, string>): void {
  __seedFs(entries);
}

export function resetFs(): void {
  __resetFs();
}

export function listFs(): { files: Record<string, string>; dirs: string[] } {
  const state = __getFsState();
  const files: Record<string, string> = {};
  for (const [path, content] of state.files) {
    files[path] = content;
  }
  return { files, dirs: Array.from(state.dirs).sort() };
}

export function fileExists(path: string): boolean {
  return __getFsState().files.has(path);
}

export function dirExists(path: string): boolean {
  return __getFsState().dirs.has(path);
}

export function getFile(path: string): string | undefined {
  return __getFsState().files.get(path);
}

export function setFile(path: string, content: string): void {
  __seedFs({ [path]: content });
}
