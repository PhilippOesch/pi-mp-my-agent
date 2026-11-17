import { vi } from "vitest";

/**
 * Global in-memory mock for `node:fs/promises`.
 *
 * See `extensions/shared/testing/README.md` for usage.
 */

export class MockFsError extends Error implements NodeJS.ErrnoException {
  public errno?: number;
  public syscall?: string;
  public path?: string;

  public constructor(
    public code: string,
    message?: string,
  ) {
    super(message ?? `${code}: mock file-system error`);
  }
}

const files = new Map<string, string>();
const dirs = new Set<string>();

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/+/g, "/");
}

function parentDir(p: string): string | undefined {
  const normalized = normalizePath(p);
  const index = normalized.lastIndexOf("/");
  if (index <= 0) return undefined;
  return normalized.slice(0, index);
}

function ensureDir(p: string): void {
  dirs.add(normalizePath(p));
  const parent = parentDir(p);
  if (parent) ensureDir(parent);
}

let tempCounter = 0;

async function readFileImpl(
  path: string,
  _options?: string | { encoding?: string | null },
): Promise<string> {
  const key = normalizePath(path);
  if (files.has(key)) {
    return files.get(key)!;
  }
  if (dirs.has(key)) {
    throw new MockFsError("EISDIR", `EISDIR: ${path} is a directory`);
  }
  throw new MockFsError("ENOENT", `ENOENT: no such file or directory, ${path}`);
}

async function writeFileImpl(
  path: string,
  data: string,
  _options?:
    | string
    | {
        encoding?: string | null;
        mode?: number;
        flag?: string;
      },
): Promise<void> {
  const key = normalizePath(path);
  const parent = parentDir(key);
  if (parent) ensureDir(parent);
  files.set(key, data);
}

async function accessImpl(path: string): Promise<void> {
  const key = normalizePath(path);
  if (!files.has(key) && !dirs.has(key)) {
    throw new MockFsError(
      "ENOENT",
      `ENOENT: no such file or directory, ${path}`,
    );
  }
}

async function statImpl(path: string): Promise<{
  isFile: () => boolean;
  isDirectory: () => boolean;
  size: number;
}> {
  const key = normalizePath(path);
  if (files.has(key)) {
    const content = files.get(key)!;
    return {
      isFile: () => true,
      isDirectory: () => false,
      size: Buffer.byteLength(content, "utf8"),
    };
  }
  if (dirs.has(key)) {
    return {
      isFile: () => false,
      isDirectory: () => true,
      size: 0,
    };
  }
  throw new MockFsError("ENOENT", `ENOENT: no such file or directory, ${path}`);
}

async function mkdirImpl(
  path: string,
  options?: { recursive?: boolean },
): Promise<void> {
  const key = normalizePath(path);
  if (options?.recursive) {
    ensureDir(key);
  } else {
    dirs.add(key);
  }
}

async function readdirImpl(path: string): Promise<string[]> {
  const key = normalizePath(path);
  if (!dirs.has(key)) {
    throw new MockFsError("ENOENT", `ENOENT: no such directory, ${path}`);
  }

  const prefix = key.endsWith("/") ? key : `${key}/`;
  const seen = new Set<string>();
  for (const filePath of files.keys()) {
    if (filePath.startsWith(prefix)) {
      const relative = filePath.slice(prefix.length);
      const first = relative.split("/")[0];
      if (first) seen.add(first);
    }
  }
  for (const dirPath of dirs) {
    if (dirPath.startsWith(prefix) && dirPath !== key) {
      const relative = dirPath.slice(prefix.length);
      const first = relative.split("/")[0];
      if (first) seen.add(first);
    }
  }
  return Array.from(seen).sort();
}

async function mkdtempImpl(prefix: string): Promise<string> {
  const normalizedPrefix = normalizePath(prefix);
  const separator = normalizedPrefix.endsWith("/") ? "" : "/";
  const dir = `${normalizedPrefix}${separator}tmp-${Date.now()}-${tempCounter++}`;
  ensureDir(dir);
  return dir;
}

export const readFile = vi.fn(readFileImpl);
export const writeFile = vi.fn(writeFileImpl);
export const access = vi.fn(accessImpl);
export const stat = vi.fn(statImpl);
export const mkdir = vi.fn(mkdirImpl);
export const readdir = vi.fn(readdirImpl);
export const mkdtemp = vi.fn(mkdtempImpl);

export function __getFsState(): {
  files: ReadonlyMap<string, string>;
  dirs: ReadonlySet<string>;
} {
  return { files, dirs };
}

export function __resetFs(): void {
  files.clear();
  dirs.clear();
  tempCounter = 0;
  readFile.mockImplementation(readFileImpl);
  readFile.mockClear();
  writeFile.mockImplementation(writeFileImpl);
  writeFile.mockClear();
  access.mockImplementation(accessImpl);
  access.mockClear();
  stat.mockImplementation(statImpl);
  stat.mockClear();
  mkdir.mockImplementation(mkdirImpl);
  mkdir.mockClear();
  readdir.mockImplementation(readdirImpl);
  readdir.mockClear();
  mkdtemp.mockImplementation(mkdtempImpl);
  mkdtemp.mockClear();
}

export function __seedFs(entries: Record<string, string>): void {
  for (const [path, content] of Object.entries(entries)) {
    const normalized = normalizePath(path);
    const parent = parentDir(normalized);
    if (parent) ensureDir(parent);
    files.set(normalized, content);
  }
}
