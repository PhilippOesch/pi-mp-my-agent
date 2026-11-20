---
name: research
description: Research a question or topic against high-trust primary sources. Splits the topic into angles, dispatches scout/explorer/Azure DevOps/Figma subagents in parallel, and synthesizes one structured answer. If the user asks for a saved write-up, also writes the findings to a Markdown file in the repo. Use when the user wants a topic researched, docs or API facts gathered, or reading legwork delegated to a background agent.
---

The topic is the user's request passed to this skill (the text after `/skill:research`).

This is research-only: do not modify files unless the user explicitly asks for a saved write-up (see "Save mode").

## Process

1. Split the topic into 2-4 distinct research angles. Done when each angle is a one-sentence subtask.

2. Dispatch relevant subagents in parallel using the **subagent** tool's `tasks` array:
    - For each codebase angle, assign `scout` with the angle and overall topic.
    - For each web angle, assign `explorer` with the angle and overall topic.
    - For each live Azure DevOps angle, assign `azure-devops-navigator` with the angle and overall topic. It has read-only ADO tools.
    - For each Figma angle, assign `figma-navigator` with the angle and overall topic. Use it to inspect Figma files, nodes, variables, or design-system context; include any supplied Figma URL and node ID. Keep the task read-only.

3. Verify against primary sources: investigate against official docs, source code, specs, and first-party APIs, not secondary write-ups. Follow every claim back to the source that owns it.

4. Synthesize the returned results into one structured answer:
    - Local findings: files, code, and architecture from scouts.
    - Web findings: cited summaries from explorers.
    - Azure DevOps findings: live project data from the navigator.
    - Figma findings: design details and source links from the navigator.
    - Key takeaways.
    - Open questions or conflicts between sources.

Done when the synthesis is returned and every factual claim is tied to a scout result, a web citation, an Azure DevOps result, a Figma result, or explicitly flagged uncertain.

## Save mode

If the user asks to save, write up, or document the findings (e.g. "research X and save it"): instead of an in-chat-only answer, spin up a **background agent** to do the research so you keep working while it reads, then write the findings to a single Markdown file, citing each claim's source. Save it where the repo already keeps such notes; match the existing convention. If there is none, put it somewhere sensible and say where. Report the saved path.
