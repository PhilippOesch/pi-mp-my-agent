# memory

Self-owned, dependency-free Pi extension replacing `pi-memory`. Provides long-term memory, scratchpad, daily logs, recoverable deletes, exit summaries, session handoff, and built-in search.

## Migration from pi-memory

1. Install this package in Pi.
2. **Uninstall `pi-memory`** to avoid double memory injection.
3. Existing data under `~/.pi/agent/memory/` continues to work — on-disk formats remain compatible.

## Tools

| Tool             | Purpose                                                                 |
| ---------------- | ----------------------------------------------------------------------- |
| `memory_write`   | Append/overwrite `MEMORY.md` or today's daily log.                      |
| `scratchpad`     | Add, complete, undo, or clear scratchpad items.                         |
| `memory_read`    | Read `MEMORY.md`, `SCRATCHPAD.md`, a daily log, or list all daily logs. |
| `memory_forget`  | Delete matching blocks and write a recovery record.                     |
| `memory_restore` | Restore a block from a recovery record.                                 |
| `memory_search`  | Built-in keyword search across all memory files.                        |
| `memory_status`  | Inventory, search backend, and resolved configuration.                  |

## Environment variables

| Variable                                  | Default               | Description                                                                      |
| ----------------------------------------- | --------------------- | -------------------------------------------------------------------------------- |
| `PI_MEMORY_DIR`                           | `~/.pi/agent/memory/` | Base memory directory.                                                           |
| `PI_MEMORY_SNAPSHOT`                      | `stable`              | Injection mode: `stable`, `refresh`, or `per-turn`.                              |
| `PI_MEMORY_NO_SEARCH`                     | unset                 | Set to `1` to disable per-turn search.                                           |
| `PI_MEMORY_SUMMARIZE_TRANSITIONS`         | unset                 | Set to `1`/`true`/`yes`/`on` to summarize on `/reload`/`/new`/`/resume`/`/fork`. |
| `PI_MEMORY_EXIT_SUMMARY`                  | unset (enabled)       | Set to `0`/`off`/`false`/`no` to disable.                                        |
| `PI_MEMORY_EXIT_SUMMARY_MODEL`            | session model         | `provider/model-id` for the exit-summary LLM.                                    |
| `PI_MEMORY_EXIT_SUMMARY_REASONING_EFFORT` | `low`                 | Reasoning effort, or `off` to omit.                                              |
| `PI_MEMORY_EXIT_SUMMARY_TIMEOUT_MS`       | `10000`               | Self-imposed timeout for the exit summary.                                       |
| `PI_MEMORY_CONTEXT_MAX_CHARS`             | `16000`               | Overall injected context cap.                                                    |
| `PI_MEMORY_CONTEXT_LONG_TERM_MAX_CHARS`   | `4000`                | Cap for the `MEMORY.md` section.                                                 |
| `PI_MEMORY_CONTEXT_SCRATCHPAD_MAX_CHARS`  | `2000`                | Cap for open scratchpad items.                                                   |
| `PI_MEMORY_CONTEXT_DAILY_MAX_CHARS`       | `3000`                | Cap for today/yesterday sections.                                                |
| `PI_MEMORY_CONTEXT_SEARCH_MAX_CHARS`      | `2500`                | Cap for per-turn search results.                                                 |

## Search

Search uses `node:sqlite` FTS5 when available and falls back to a hand-rolled BM25 implementation. The fallback is selected automatically at session start by probing `PRAGMA compile_options` for `ENABLE_FTS5`.

## Files

```
~/.pi/agent/memory/
├── MEMORY.md
├── SCRATCHPAD.md
├── daily/<YYYY-MM-DD>.md
├── recovery/<uuid>.json
└── index.db          # FTS5 index (when FTS5 is available)
```

## Verify changes

```bash
cd extensions/memory
npm test
npm run typecheck
npm run lint
npm run format:check
npm run circular
```
