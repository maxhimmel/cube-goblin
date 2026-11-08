# AI agent practices: Matt Pocock and poteto

Researched 2026-11-08. Mostly secondary write-ups, not the authors' own text; check the originals before relying on specifics. Rules adopted from this: [CLAUDE.md](../../CLAUDE.md).

## Matt Pocock

- **Skills repo** (`mattpocock/skills`): his own `.claude` setup, published. Aimed at AI coding problems: misunderstanding the task, no shared language, no feedback loops.
- **Ubiquitous language**: a skill pulls a DDD-style glossary out of the conversation, flags ambiguous terms, and proposes canonical ones, saved to `UBIQUITOUS_LANGUAGE.md`. Our version: [GLOSSARY.md](../GLOSSARY.md).
- **grill-with-docs**: grills the user against a context doc to build that shared language.
- **Steering**: a short CLAUDE.md, docs pulled in only when needed (progressive disclosure), skills, memory. The local `writing-for-agents` skill follows the same ideas: context pointers, one source of truth, leading words.
- No first-party CLAUDE.md best-practices text turned up.

Sources:

- [learnAIDoc wiki](https://weihaoqu.github.io/learnAIDoc/wiki/matt-pocock-skills-real-engineers/)
- [ubiquitous-language skill](https://claudemarketplaces.com/skills/vinvcn/mattpocock-skills-zh-cn/ubiquitous-language)
- [AI Hero: steering workshop](https://www.aihero.dev/workshops/day-2-steering-7ucsx)
- [Medium: repo that adds friction](https://medium.com/@marc.bara.iniesta/the-ai-coding-repo-that-went-viral-because-it-adds-friction-e2b5c4d2fcc2)

## poteto (Lauren Tan)

Author of **pstack**, an open-source set of agent skills and workflows.

- **Verify, don't just prompt**: the agent runs the app and tests its own changes.
- **Start local, scale slowly**: watch one or two local agents before fanning out to many cloud agents.
- **Plan against reality**: prototype, benchmark, screenshot, so the plan hits real code early.
- **Lessons become skills**: turn a repeated fix into a skill. Evals are unit tests for skills: a coordinator writes a rubric, subagents test against it.
- **Lean context**: keep in always-loaded instructions only what the agent needs nearly every time; load the rest on demand.
- **Build the lever**: turn repeated manual work into a tool the agent can call.
- Unconfirmed anecdote: agents auto-merging PRs overnight, reviewed afterward.

Sources:

- [The Neuron: pstack explained](https://www.theneuron.ai/explainer-articles/pstack-explained-lauren-tans-system-for-trustworthy-ai-agents/)
- [Level Up Coding: build a system you can trust](https://levelup.gitconnected.com/stop-watching-your-coding-agent-build-a-system-you-can-trust-780e678b0ae3)
- [Talk summary](https://youtubesummary.com/summary/I_oMJk6barY)
- [Poteto Mode skill](https://mcpmarket.com/tools/skills/poteto-mode)
