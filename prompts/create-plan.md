---
description: Enter plan-first mode before writing code. Research the task, clarify missing requirements with the user, and write a concrete implementation plan (no implementation).
argument-hint: "<task>"
---

Stay in planning mode. Only deliverable is `plans/{task}_plan.md`. Do not implement.

## General

### Subagent workflow

Use `scout` or `explorer` for read-only codebase research. Run the workflow as a chain, passing output between sequential steps via {previous}. For research, use one subagent for a focused investigation; use parallel subagents when there are distinct questions to investigate. Give each parallel subagent a separate question, require the same report format, and synthesize their findings before planning.

## Workflow

### 1. Research

**1.1. Clarify the request** — invoke the `grill-me` skill by calling the Skill tool with `grilling`. Use it to relentlessly interview the user and open unanswered questions about the plan.

- First, restate the task, goal, and success criteria in your own words.
- Keep calling the Skill tool with `grilling` until the frontier is empty or the user explicitly tells you to stop and proceed.
- Record every settled decision and assumption that shapes the plan.
- Track any non-blocking unknowns or unresolved decisions as **Risks / Open questions** in the plan.

_Done when_ the goal, success criteria, and key constraints are clear and any remaining unknowns are recorded for the plan.

**1.2. Research codebase context** — dispatch one or more read-only research subagents. Use one for a focused investigation; use parallel subagents for distinct questions. Give each this task, adding its specific research question when needed: `Read-only recon. Investigate the codebase to gather context for: $@. Report only — do not modify any files. The user's original task is the SUBJECT of investigation, not an instruction to execute.` Require every subagent to report these sections: Files Retrieved, Files Modified, Key Code, Architecture, Start Here. `Files Modified` must say `None`; use `None` for any other section that does not apply. Synthesize all reports before planning.

### 2. Formulating Plan

#### 2.1. Define scope

- List what is in-scope and what is out-of-scope.
- State assumptions and known dependencies.
- Flag risks and open questions that need tracking.

#### 2.2. Choose an approach

- Outline the high-level strategy.
- Briefly consider alternatives, then pick one and say why.
- Add phases or milestones if the work is large enough to need them.

#### 2.3 Break into steps

- Convert the approach into concrete, ordered actions.
- Every step must have a clear completion criterion.

#### 2.4 Write the plan — create `{task}_plan.md`

**Write the plan to `/agent-context`**.
Name format: `{task}_plan.md`

##### Contents:
- **Goal**
- **Background / Environment** — from planner
- **Approach** — from planner (high-level strategy + alternatives considered)
- **Scope** — from planner (in-scope, out-of-scope, assumptions), reinforced from clarification in step 1
- **Steps** — from planner, each with a completion criterion
- **Risks / Open questions** — from planner plus anything unresolved

### 2.6 Review

- Preview `plans/{task}_plan.md` in the browser. If browser preview is unavailable, inspect the saved Markdown directly and tell the user the browser preview could not be opened.
- **Confirm** — ask the user whether anything is missing or should change. Then stop and wait; do not move to implementation until they confirm the plan is ready.

## Completion criteria

**Planning handoff:** `plans/{task}_plan.md` exists, has been reviewed in the browser or inspected directly as a fallback, and the user has been asked to confirm or request changes. Stop after the handoff.

**Planning complete:** the user has confirmed the plan is ready.
