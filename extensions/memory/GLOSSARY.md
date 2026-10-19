# Memory Extension Glossary

## MemoryPaths

Value object holding resolved filesystem paths for `MEMORY.md`, `SCRATCHPAD.md`, `daily/`, and `recovery/` under `PI_MEMORY_DIR`.

## MemoryEntry

A stamped block parsed from a memory file: a marker comment line plus its trailing content lines until the next marker or end-of-file.

## RecoveryRecord

Version-1 JSON schema written before any `memory_forget` mutation. Captures `target`, optional `date`, and `removedContent`. Marked with `restoredAt` when `memory_restore` succeeds.

## MemoryContext

The assembled `# Memory` block injected into `systemPromptOptions.sections["memory"]`: guidance header plus prioritized, capped sections joined by `\n\n---\n\n`.

## SearchBackend

Interface used by tools and hooks. Implemented by `Fts5Search` and `Bm25Search`, selected once per session based on `PRAGMA compile_options`.

## MemorySnapshot

Session-scoped cache of the injected context block, with modes `stable`, `refresh`, and `per-turn` controlling when it rebuilds.
