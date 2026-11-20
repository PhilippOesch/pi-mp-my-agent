---
name: implement-and-review
description: Worker implements, reviewer reviews, worker applies feedback. Use when the user wants a change implemented with a review pass and feedback applied afterwards.
---

Use the **subagent** tool with the chain parameter to execute this workflow. The task is the user's request passed to this skill (the text after `/skill:implement-and-review`).

1. First, use the `worker` agent to implement: the task
2. Then, use the `code-reviewer` agent to review the implementation from the previous step (use {previous} placeholder)
3. Finally, use the `worker` agent to apply the feedback from the review (use {previous} placeholder)

Execute this as a chain, passing output between steps via {previous}.
