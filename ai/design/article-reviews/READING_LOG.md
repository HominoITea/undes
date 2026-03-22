# Article Review Reading Log

Shared reading log for all models working with [links.txt](/home/kair/ai_agents_coding/ai-hub-coding/ai/design/article-reviews/links.txt).

This file tracks:
- which links were already read;
- which links could not be opened;
- which model reviewed them;
- where that model saved its final write-up.

## Status Values

- `READ` — the article was opened and reviewed successfully.
- `BLOCKED` — the article could not be opened or read in the current environment.
- `RETRY` — the article should be retried later even though a prior attempt failed.

## Log Format

Use one entry per review pass.

Template:

```md
## [YYYY-MM-DD HH:mm:ss UTC] - Model: <name>
Resume File: `resume_<MODEL>.txt`
Scope: <what was attempted>
Results:
- `<url>` | Status: READ | Notes: <short note>
- `<url>` | Status: BLOCKED | Notes: <short note>
Summary: <short batch summary>
```

Rules:
- always use UTC timestamps;
- keep notes short and factual;
- if a previously blocked link becomes readable later, add a new entry instead of rewriting old history;
- do not store the full article analysis here, only reading progress;
- the full analytical verdict belongs in `resume_<MODEL>.txt`.

## Entries

## [2026-03-10 00:21:00 UTC] - Model: Codex
Resume File: `resume_Codex.txt`
Scope: Initial review pass over the first article batch from `links.txt`.
Results:
- `https://habr.com/ru/companies/bothub/news/995986/` | Status: READ | Notes: reviewed successfully
- `https://habr.com/ru/companies/X5Tech/articles/995466/` | Status: READ | Notes: reviewed successfully
- `https://habr.com/ru/companies/itfb/articles/1000980/` | Status: BLOCKED | Notes: did not open in current environment
- `https://habr.com/ru/articles/995038` | Status: READ | Notes: reviewed successfully
- `https://habr.com/ru/articles/995838` | Status: BLOCKED | Notes: did not open in current environment
- `https://habr.com/ru/articles/996154` | Status: READ | Notes: reviewed successfully
- `https://habr.com/ru/articles/994618` | Status: READ | Notes: reviewed successfully
- `https://habr.com/ru/articles/1000976` | Status: READ | Notes: reviewed successfully
- `https://habr.com/ru/articles/1000718` | Status: READ | Notes: reviewed successfully
- `https://habr.com/ru/articles/1001368` | Status: READ | Notes: reviewed successfully
Summary: 8 links reviewed, 2 links blocked, analytical verdict saved in `resume_Codex.txt`.

## [2026-03-10 22:30:00 UTC] - Model: Gemini CLI
Resume File: `resume_Gemini.txt`
Scope: Review the two remaining articles that were blocked for Codex.
Results:
- `https://habr.com/ru/articles/995838` | Status: READ | Notes: successfully fetched via web_fetch, reviewed AST-based tokenization.
- `https://habr.com/ru/companies/itfb/articles/1000980/` | Status: READ | Notes: successfully fetched via raw curl, reviewed prompt structure formula.
Summary: 2 previously blocked links reviewed successfully, analytical verdict saved in `resume_Gemini.txt`.

## [2026-03-10 23:45:00 UTC] - Model: Claude Opus 4.6
Resume File: `resume_Claude.txt`
Scope: Full review pass over all 10 articles from `links.txt`.
Results:
- `https://habr.com/ru/companies/bothub/news/995986/` | Status: READ | Notes: WebFetch direct, hashline edit protocol
- `https://habr.com/ru/companies/X5Tech/articles/995466/` | Status: READ | Notes: WebFetch direct, Spec-Driven Development
- `https://habr.com/ru/companies/itfb/articles/1000980/` | Status: READ | Notes: WebFetch direct (previously blocked for Codex), prompt formula
- `https://habr.com/ru/articles/995038` | Status: READ | Notes: WebFetch direct, AI Factory
- `https://habr.com/ru/articles/995838` | Status: READ | Notes: WebFetch direct (previously blocked for Codex), GPT from scratch
- `https://habr.com/ru/articles/996154` | Status: READ | Notes: WebFetch direct, Graph-RAG semantic memory
- `https://habr.com/ru/articles/994618` | Status: READ | Notes: via WebSearch cache (403 on direct fetch), 3-tier agent memory
- `https://habr.com/ru/articles/1000976` | Status: READ | Notes: WebFetch direct, ProTalk Codex IDE
- `https://habr.com/ru/articles/1000718` | Status: READ | Notes: via braintools.ru mirror (403 on direct fetch), code review scoring
- `https://habr.com/ru/articles/1001368` | Status: READ | Notes: WebFetch direct, EchoVault local memory
Summary: 10 links reviewed (8 direct, 2 via search cache/mirror), analytical verdict saved in `resume_Claude.txt`.

## [2026-03-13 14:23:17 UTC] - Model: Codex
Resume File: `resume_Codex.txt`
Scope: Review the newly added article about replacing tree-sitter / vector search with grep-ast.
Results:
- `https://habr.com/ru/companies/ecom_tech/articles/1005610/` | Status: READ | Notes: reviewed successfully, grep-ast as structural search layer
Summary: 1 new link reviewed, analytical addendum appended to `resume_Codex.txt`.


## [2026-03-22 05:30:00 UTC] - Model: Gemini CLI
Resume File: `resume_Gemini_CLI.txt`
Scope: Review pass over the new article batch from links.txt (under ---21,03,2026---).
Results:
- `https://habr.com/ru/articles/1012106` | Status: READ | Notes: Documentation-Driven Development, claude.md as entrypoint.
- `https://habr.com/ru/companies/cloud_ru/articles/1011868/` | Status: READ | Notes: Context clearing practices, one task = one context.
- `https://ai-manual.ru/article/30-patternov-inzhenerii-ii-sistem-razbor-antipatternov-i-luchshih-praktik-ot-ekspertov/` | Status: READ | Notes: Engineering patterns (Sequential Thinking, Critical Stance).
- `https://habr.com/ru/companies/ostrovok/articles/1008652/` | Status: READ | Notes: Navigation agents (Serena MCP style).
- `https://habr.com/ru/articles/1010522/` | Status: READ | Notes: Local RAG via Markdown, Role-specific instructions.
Summary: 5 new links reviewed successfully, analytical verdict saved in `resume_Gemini_CLI.txt`.

## [2026-03-21 18:25:00 UTC] - Model: Codex
Resume File: `resume_Codex.txt`
Scope: Independent reread of the fresh 21.03.2026 batch using direct page fetch/open only.
Results:
- `https://habr.com/ru/articles/1012106` | Status: READ | Notes: docs-first workflow, Claude.md, Sequential thinking, Serena
- `https://habr.com/ru/companies/cloud_ru/articles/1011868/` | Status: READ | Notes: A2A / AGP, AgentCard, capability-policy-cost routing
- `https://ai-manual.ru/article/30-patternov-inzhenerii-ii-sistem-razbor-antipatternov-i-luchshih-praktik-ot-ekspertov/` | Status: READ | Notes: blind RAG, observability, router-specialist-synthesizer, fallback cascade
- `https://habr.com/ru/companies/ostrovok/articles/1008652/` | Status: READ | Notes: evals, semantic monitoring, flywheel, granular feedback
- `https://habr.com/ru/articles/1010522/` | Status: READ | Notes: autonomous agent architecture, GraphRAG, EventBus, Docker sandbox
Summary: 5 fresh links independently reviewed; analytical addendum appended to `resume_Codex.txt` with quality-first and cost-aware recommendations for the hub.

## [2026-03-22 09:15:00 UTC] - Model: Claude Opus 4.6
Resume File: `resume_Claude.txt`
Scope: Review pass over the new article batch from links.txt (under ---21,03,2026---).
Results:
- `https://habr.com/ru/articles/1012106` | Status: READ | Notes: Documentation-driven dev, claude.md as entrypoint, MCP plugins.
- `https://habr.com/ru/companies/cloud_ru/articles/1011868/` | Status: READ | Notes: A2A Protocol (Agent-to-Agent), NOT context clearing as Gemini noted.
- `https://ai-manual.ru/article/30-patternov-inzhenerii-ii-sistem-razbor-antipatternov-i-luchshih-praktik-ot-ekspertov/` | Status: READ | Notes: 30 AI engineering patterns, Router->Specialist->Synthesizer, Fallback Cascade.
- `https://habr.com/ru/companies/ostrovok/articles/1008652/` | Status: READ | Notes: 30 patterns in 5 layers (Interface, Context, Flow, Cognitive, Observability).
- `https://habr.com/ru/articles/1010522/` | Status: READ | Notes: AAF framework, Reverse Graph-RAG, Docker-isolated subagents.
Summary: 5 new links reviewed, 2 attribution corrections vs Gemini's analysis, analytical verdict appended to `resume_Claude.txt`.
