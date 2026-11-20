---
name: implement-plan
description: Implement an existing plan from the agent-context plans folder, then review and apply feedback. Use when the user wants to execute a previously written plan. An optional plan name can be passed as the skill argument.
---

Use the **subagent** tool with the chain parameter to execute this workflow.

A plan is the minimum requirement. If no plan exists, stop and tell the user.

## Plan discovery

The optional plan name is the user's request passed to this skill (the text after `/skill:implement-plan`).

1. Find the plan based on the plan name inside of the `/agent-context`. If absent, stop — report a plan is required.
2. If exactly one plan file exists, use it.
3. If multiple exist, infer from current context. If still ambiguous, ask the user.
4. If a plan name was given, prefer that one.

## Workflow

Execute as a chain. Pass output between steps via {previous}.

1. Implement — dispatch `worker` with the plan content
2. Review — dispatch `code-reviewer` with the implementation output ({previous})
3. Apply — dispatch `worker` with the review output ({previous})

## Completion criterion

- A plan was found and selected
- All three chain steps completed
- Final worker output reports files changed and applied review feedback
