# Competitive Positioning

Status: active
Updated: 2026-03-22
Audience: Founder / Commercial / Marketing

## Our Category

ai-hub-coding is a **multi-agent AI code analysis and generation pipeline** — not a coding assistant.

Most AI coding tools are interactive chat-based assistants (1 user, 1 model, turn-by-turn).
We are an orchestrated pipeline where multiple models debate, critique, and produce grounded results.

## Key Differentiators

| Capability | ai-hub-coding | Typical AI coding tools |
|---|---|---|
| Architecture | 7 agents, 3 providers, 8-phase pipeline | 1 agent, 1 model, chat loop |
| Multi-model debate | Structured: proposal, critique, consensus, DA review, arbitration | None |
| Code understanding | Symbol-level index (tree-sitter), outline, container, callEdges, trust labels | File-level or LSP-assisted |
| Context intelligence | L0/L1/L2 levels, BFS expansion, seam expansion, small-file heuristic | Full file inclusion or basic RAG |
| Stack awareness | Auto stack detection, `.ai/stack-profile.json`, derived `llms.md` | Manual or none |
| Quality gates | Evidence grounding, trust labels, approval rounds | None |
| Output | Structured analysis + patch with evidence trail | Inline code edits |
| Resilience | One agent crashes, pipeline continues (Promise.allSettled) | Single point of failure |

## Competitive Landscape

### OpenCode (opencode.ai)

- **What:** Open-source terminal AI coding assistant (Go, Bubble Tea TUI)
- **Model:** 1 agent, 1 provider per session, 30+ models supported
- **Strengths:** Clean TUI, multi-provider support, open-source, MCP extensibility
- **No:** code indexing, structured analysis, multi-model debate, evidence grounding
- **Status:** Archived Sep 2025, continued as "Crush" by Charm team
- **Differentiation from us:** OpenCode is a chat assistant for individual devs. We are a pipeline for teams that need grounded, multi-perspective analysis.

### Claude Code (Anthropic)

- **What:** Official Anthropic CLI for Claude
- **Model:** 1 model (Claude), agentic tool-calling loop
- **Strengths:** Deep tool integration, agentic workflow, shell access, file editing
- **No:** multi-model debate, structured pipeline, custom code indexing
- **Differentiation from us:** Claude Code is a powerful single-agent tool. We orchestrate multiple agents (including Claude) with quality gates.

### Cursor / Copilot / Windsurf

- **What:** IDE-integrated AI coding assistants
- **Model:** 1 model per interaction, IDE context
- **Strengths:** IDE integration, inline suggestions, low friction
- **No:** multi-agent pipeline, structured debate, evidence grounding, standalone CLI
- **Differentiation from us:** IDE tools optimize for speed and convenience. We optimize for analysis depth and correctness.

### Codex CLI (OpenAI)

- **What:** Terminal-based coding agent
- **Model:** 1 model (GPT), agentic loop
- **Strengths:** Strong coding model, tool calling, sandbox execution
- **No:** multi-model debate, code indexing with trust labels
- **Differentiation from us:** Same category difference as Claude Code — single agent vs. orchestrated pipeline.

## What Only We Have

1. **Multi-model structured debate** — proposal, critique, consensus, DA review, arbitration between Claude/GPT/Gemini
2. **Semantic Context Bridge** — symbol-level code index with trust labels (exact-ast, approx-ast, regex-fallback), L0/L1/L2 context levels
3. **Seam expansion** — agent requests missing method body mid-pipeline, orchestrator fetches it precisely via AST ownership
4. **Evidence grounding** — agents must reference specific code lines, ungrounded claims are flagged
5. **Pipeline resilience** — one agent/provider fails, pipeline continues with partial results
6. **Stack-aware context** — auto-detected project stack informs prompt generation

## Positioning Statement

For development teams that need **reliable, evidence-based code analysis** — not just fast code suggestions — ai-hub-coding provides a multi-agent pipeline where AI models debate and verify each other's work, producing grounded results with explicit trust levels.

Unlike single-agent coding assistants, ai-hub-coding treats code analysis as a **structured decision process**, not a conversation.
