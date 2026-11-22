# pi-mp-my-agent

A self-contained Pi package with extensions, skills, themes, and agents. All skills referenced by agents ship in `skills/`, so no external skill collection is required.

## Install

From git:

```bash
pi install git:github.com/PhilippOesch/pi-mp-my-agent
```

Or use a local copy during development:

```bash
pi install ./path/to/pi-config
```

## Contents

- `extensions/` — Pi extensions
- `skills/` — Skills shipped with this package. Five are referenced by agents (`tdd`, `refactor`, `code-review`, `research`, `writing-for-agents`); the rest are workflow skills converted from the former prompt templates (`create-plan`, `git-commit`, `implement-plan`, `implement-and-review`). The `research` skill covers both chat synthesis and saved write-ups ("save mode").
- `themes/` — Custom themes
- `agents/` — Subagent definitions loaded by the `subagents` extension

## Skills

Use skills via `/skill:name` (arguments after the name are passed as the user request):

```text
/skill:create-plan add caching to the session store
/skill:implement-plan my-feature
/skill:implement-and-review add input validation to API endpoints
/skill:research how does the auth flow work
/skill:git-commit
```

`scripts/check-agents.mjs` fails if an agent declares a `skills:` entry that has no matching `skills/<name>/SKILL.md` in this package, so the package stays self-contained.

## Favorite models

The `favorite-models` extension adds a favorites-first model picker with cost
tier labels.

- `/fmodel` (or `Ctrl+L`) opens the selector: favorites first, each row shows
  the model's cost tier and per-1M-token prices.
- In nav mode: `↑/↓` move, `Space` toggles favorite, `t` cycles the tier of the
  highlighted model, `Enter` switches, `Ctrl+S` switches and saves as global
  default, `/` filters, `Esc` cancels.
- `t` cycles `free → low → mid → high → maxi → free` (unknown starts at
  `free`). The chosen tier is stored as a user override that wins over the
  hardcoded tier map; it feeds the row display, the fuzzy filter, and the
  `tier:` footer status.
- Data lives in `~/.pi/agent/favorite-models.json` (`favorites` array plus a
  `tierOverrides` map keyed by `provider/modelId`). Remove an override by
  editing the file.

## Personal config

This repo is a package, not a runnable `~/.pi/agent` directory. In your
personal Pi config (e.g. `~/.pi/agent/`) add the package:

```json
{
    "packages": ["git:github.com/PhilippOesch/pi-mp-my-agent"]
}
```

Create your own `settings.json`, `keybindings.json`, `blacklist.json`, and
`mcp.json` in `~/.pi/agent/` as needed.

`pi-mp-my-agent.config.json` in your Pi agent directory (normally
`~/.pi/agent/`) is optional and configures package behavior. For example:

```json
{
    "agents": {
        "whitelist": ["code-reviewer", "worker"]
    },
    "skills": {
        "whitelist": ["tdd", "refactor"]
    },
    "readModeToggle": {
        "keybinding": "alt+ctrl+x"
    }
}
```

If `agents.whitelist` is empty or omitted, all agents from this package are
enabled. Agent names correspond to the file names in the `agents/` directory
(without the `.md` extension).

If `skills.whitelist` is empty or omitted, all skills from this package are
enabled. Skill names correspond to the frontmatter `name` in each skill's
`SKILL.md` file (e.g., `tdd`, `refactor`, `create-plan`). Non-whitelisted
package skills are fully removed: they do not appear in the system prompt and
`/skill:<name>` commands for them are blocked with a notification. User, project,
and other-package skills are not affected. Run `/reload` after editing this file.

`readModeToggle.keybinding` replaces the save/yolo mode toggle shortcut
(default: `ctrl+shift+m`); `/mode` still works. Omit the setting to keep the
default. Use Pi key syntax such as `alt+ctrl+x` (lowercase modifiers and
letters; special keys use Pi's spelling, such as `pageUp`). Invalid values produce a
console warning and fall back to the default without discarding a valid agent
whitelist. Run `/reload` after editing this file. Pi handles shortcut conflicts;
use `/hotkeys` to inspect active shortcuts. Some combinations require terminal
keyboard protocol support.

`mcp.json`, `auth.json`, `trust.json`, `models-store.json`, `memory/`, and
`sessions/` are generated at runtime and are not tracked.

## Development

Load the package locally for one Pi session without installing it:

```bash
pi -e ./path/to/pi-mp-my-agent
```

Inside Pi, run `/reload` after making changes to extensions, skills, themes, or agents so the runtime picks them up.

To install the package persistently (personal scope):

```bash
pi install ./path/to/pi-mp-my-agent
```

Or add it to `~/.pi/agent/settings.json`:

```json
{
    "packages": ["./path/to/pi-mp-my-agent"]
}
```

Validate the agent definitions before committing:

```bash
npm run check:agents
```

Run the full repo verification from the root:

```bash
npm install
npm run typecheck
npm run lint
npm run format
npm run format:check
npm test
npm run circular
npm run check
```

## License

MIT — see [LICENSE](./LICENSE).
