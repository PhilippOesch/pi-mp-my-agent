---
name: git-commit
description: Generate a Conventional Commit message for the staged diff. Use when the user asks for a commit message. Delegates to the commit-writer agent, which runs on a cheap model.
---

Use the **subagent** tool to dispatch the `commit-writer` agent with this task:

```
Generate a Conventional Commit message for the staged diff. Output only the commit message.
```

Report the agent's output verbatim as the commit message.
