# Memory Extension

Long-term memory, scratchpad, daily logs, and recoverable deletes for Pi.

## When you touch this code

- **Dates, markers, entry splitting** → `src/storage/dates.ts`
- **File writes, reads, entry blocks** → `src/storage/files.ts`
- **Scratchpad parsing and mutations** → `src/storage/scratchpad.ts`
- **Recoverable deletes** → `src/storage/recovery.ts`
- **Env parsing and defaults** → `src/config.ts`
- **Context-block assembly and caps** → `src/context.ts`
- **Search backend selection** → `src/search/index.ts`
- **FTS5 search backend** → `src/search/fts5.ts`
- **Hand-rolled BM25 fallback** → `src/search/bm25.ts`
- **Tool definitions and wiring** → `src/tools.ts`
- **Lifecycle hooks (snapshot, injection, handoff, exit summary)** → `src/hooks.ts`
- **Snapshot state machine** → `src/snapshot.ts`

## Invariants to preserve

- On-disk formats remain byte-compatible with `pi-memory`: stamped entry markers, blank-line separation, `RecoveryRecord` v1, and `flag: "wx"` recovery writes.
- Context injection uses `event.systemPromptOptions.sections["memory"]`; never mutate `event.systemPrompt` directly.
- Exit summary uses `ctx.modelRegistry.complete`, never `pi-ai/compat`.
- Search is `node:sqlite` FTS5 primary with a hand-rolled BM25 fallback selected once per session.
- Zero runtime npm dependencies: only Node built-ins plus peer-provided `typebox` and `@earendil-works/pi-ai` / `pi-coding-agent`.

## Verify changes

Run from `extensions/memory/`:

```bash
npm test
npm run typecheck
npm run lint
npm run format:check
npm run circular
```

For a manual end-to-end check, reload Pi (`/reload`) and exercise `memory_write`, `scratchpad`, `memory_read`, `memory_forget`, `memory_restore`, `memory_search`, and `memory_status`.

## Entry points

- `src/index.ts` registers the seven tools and four lifecycle hooks.
