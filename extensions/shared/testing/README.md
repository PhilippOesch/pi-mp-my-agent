# Shared test helpers

## In-memory `node:fs/promises` mock

The files in this folder provide a global, dependency-free in-memory mock for
`node:fs/promises`. It is intended for tests under `extensions/shared/` that
currently touch the filesystem through the promise-based API.

### Opt in

Add a top-level `vi.mock` call to your test file. Vitest hoists `vi.mock` before
other imports, so the factory form that explicitly imports the mock module works
correctly for ESM `node:` built-ins:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetFs, seedFs } from "./fs-mock.ts";

vi.mock(
  "node:fs/promises",
  async () => import("./__mocks__/node:fs/promises.ts"),
);
```

### Why the mock lives under `extensions/shared/testing/`

The plan originally suggested a repo-root `__mocks__` directory, but Vitest does
not reliably auto-resolve `node:` built-ins in ESM/`NodeNext` mode. The explicit
factory import shown above is the robust workaround. A top-level `__mocks__`
folder was tried and removed; add new tests using the pattern above instead.

### Seed and reset

Call `resetFs()` in a global `beforeEach` so every test starts with a clean
file system:

```ts
beforeEach(() => {
  resetFs();
});
```

Seed files with `seedFs`:

```ts
seedFs({
  "/path/to/file.json": JSON.stringify({ answer: 42 }),
});
```

### Available helpers

- `seedFs(entries)` — populate files.
- `setFile(path, content)` — upsert a single file.
- `resetFs()` — clear the filesystem and all mock function overrides.
- `fileExists(path)` / `dirExists(path)` — assertions helpers.
- `getFile(path)` — return the file content, if it exists.
- `listFs()` — snapshot current files and directories.

### Mocked functions

The mock currently implements:

- `readFile(path, "utf8")`
- `writeFile(path, content, options?)`
- `access(path)`
- `stat(path)`
- `mkdir(path, { recursive? }?)`
- `readdir(path)`
- `mkdtemp(prefix)`

Missing functions or option shapes throw or return `undefined`. Expand the mock
in `./__mocks__/node:fs/promises.ts` when more coverage is needed.
