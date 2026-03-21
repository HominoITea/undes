# Local Memory MVP

Status: MVP complete
Priority: P1

## Summary

Add persistent cross-session memory to the hub so agents can recall prior decisions,
facts, and resolved issues instead of starting from zero on every run.

This is the project's most significant gap identified independently by both Codex and
Claude during the article review pass (2026-03-10). Three Habr articles (994618, 996154,
1001368) describe approaches that are ahead of our current state.

## Current State

What we have:
- `ai:memory` snapshots and typed logs
- Archival of run artifacts in `.ai/prompts/archive/`
- Log window and memory window in context bundle

What we lack:
- Semantic retrieval over past decisions and solutions
- Typed memory model (fact / decision / episode / open question)
- Cross-session durable memory usable for real recall
- Shared memory API across agents within and across runs

## Target Architecture (MVP)

### Storage

```
.ai/memory/
  memory.db           # SQLite with FTS5 for keyword search
  decisions/          # Markdown files for major decisions
  episodes/           # Structured run summaries
```

No cloud dependencies. No embeddings in MVP (add sqlite-vec + Ollama later if needed).

### Typed Entries

| Type | Example | Recall trigger |
|---|---|---|
| `fact` | "Project uses Next.js 15 with App Router" | Always loaded as project context |
| `decision` | "Chose split-root layout over single .ai/" | Loaded when related files/topics appear in prompt |
| `episode` | "Run 2026-03-10: fixed JWT race condition" | Loaded via FTS5 search on prompt keywords |
| `openQuestion` | "Should we migrate to Turborepo?" | Loaded when related topics appear |

### Integration Points

1. **Pre-run recall:** Before pipeline start, FTS5 search prompt keywords → inject top-N relevant entries into context bundle (within memory budget).
2. **Post-run save:** After successful run, extract key facts/decisions from result and save as typed entries. Use structured extraction prompt or rule-based heuristics.
3. **Manual save:** `ai:memory:save` command for explicit knowledge capture.
4. **Patch integration:** `.ai/patches/` from patch-based learning loop feed into episodes.

### Budget

Memory entries compete for context space within existing `memoryWindow` budget.
Default: up to 8 entries, max 6000 bytes total.

## Reference Implementations

- **EchoVault** (article 1001368): SQLite + FTS5 + sqlite-vec + Ollama. MIT license. Best cost-aware reference.
- **Three-tier memory** (article 994618): Redis (fast facts) + ChromaDB (semantic) + Markdown (docs). Good architecture blueprint.
- **Graph-RAG** (article 996154): SPO model + pgvector + FTS. Target for Phase 2, overkill for MVP.

## Non-Goals (MVP)

- Cloud vector DB or Graph-RAG
- Embedding-based semantic search (defer to Phase 2)
- Cross-project memory sharing
- UI for memory management

## Rollout

### Phase 1 (MVP)
- SQLite + FTS5 storage
- Typed entries: fact, decision, episode
- Pre-run keyword recall
- Post-run auto-save via heuristics
- `ai:memory:save` / `ai:memory:search` commands

Status: landed on 2026-03-13.

Implemented shape:
- `.ai/memory/memory.db`
- `.ai/memory/decisions/*.md`
- `.ai/memory/episodes/*.md`
- pre-run recall injects typed memory into the context bundle before Context Pack/full tree
- successful runs auto-save one episode plus conservative decision candidates
- default `ai:memory` remains a log snapshot view; typed memory uses `ai:memory:search` and `ai:memory:save`

### Phase 2
- sqlite-vec for semantic search
- Local embeddings via Ollama
- openQuestion type with auto-resolution tracking
- Patch-based learning integration

### Phase 3
- Graph-RAG with typed relations
- Cross-project knowledge transfer
- Evidence/sourceRef grounding

## Discussion

### Code Review: Local Memory MVP — Claude (2026-03-13)

**Verdict: Accepted**

**Reviewed files:**
- `ai/scripts/local-memory.js` (609 lines) — storage layer
- `ai/scripts/memory.js` (410 lines) — CLI layer
- `ai/scripts/__tests__/local-memory.test.js` (4 tests)
- `ai/scripts/__tests__/memory-cli.test.js` (7 tests)
- Integration points in `ai/scripts/generate-context.js` (lines 2186-2193, 5008-5021)

**Test result:** 359 pass, 0 fail, 1 skipped (SQLite availability guard).

**Strengths:**

1. **Storage design is solid.** WAL mode + `SYNCHRONOUS=NORMAL`. FTS5 with `unicode61 remove_diacritics 2` handles bilingual content. BM25 weighting (`8.0, 4.0, 1.5, 1.0` for title/summary/content/tags) gives reasonable relevance ranking.
2. **Graceful degradation.** `isSqliteAvailable()` check everywhere — falls back to log-based snapshot if `node:sqlite` is unavailable. Experimental warning suppression is clean.
3. **Memory budget discipline.** `DEFAULT_MAX_BYTES = 6000`, `DEFAULT_LIMIT = 8`, facts capped at 3. `buildMemoryRecallSection()` enforces byte budget with early break.
4. **Sidecar Markdown files** for `decision` and `episode` types — human-readable artifacts alongside SQLite DB.
5. **Auto-save is non-blocking** — wrapped in try/catch at line 5008. `extractDecisionBullets()` uses bilingual heading heuristics (EN/RU). Conservative: max 2 decisions per run.
6. **Pre-run recall** at `buildProjectMemorySection()` tries typed memory first, falls back to log snapshot. Transparent upgrade path.
7. **`deleteAutoSavedEntriesForRun()`** cleans stale auto-saved entries before re-saving. No duplicate episodes from re-runs.

**Observations (non-blocking, for Phase 2 consideration):**

1. **FTS index sync is delete+insert** — fine for MVP volume; conditional update if entry count grows significantly.
2. **`splitQueryTokens` minimum length is 4** — short keywords like "JWT", "K8s", "CI" won't match via `splitQueryTokens`. FTS5 tokenizer handles full content separately, but worth noting.
3. **No schema migration mechanism** — `CREATE TABLE IF NOT EXISTS` works for MVP. Phase 2 (sqlite-vec columns) will need a migration strategy.
4. **`computeMemoryStoreDigest()` uses MD5** — fine for change detection (not security), consistent with existing codebase patterns.

## MVP Risk Debt / Assumption Register

- **Assumption:** SQLite + FTS5 is enough for the first shipped recall layer.
  - **Why accepted now:** lowest-friction local durability with no cloud or embedding stack.
  - **User/operator risk:** recall quality can look "good enough" while still missing semantically related prior work.
  - **Revisit trigger:** repeated pilot evidence that obvious prior fixes are not recalled unless wording matches closely.
  - **Exit path:** add semantic retrieval/reranking in Phase 2.

- **Assumption:** Keyword-first recall is acceptable even though short tokens are weak.
  - **Why accepted now:** simple query expansion and FTS5 cover a lot of practical cases with almost no runtime cost.
  - **User/operator risk:** terms like `JWT`, `K8s`, `CI` and similarly short stack markers can be under-recalled, causing false confidence that memory "has nothing relevant".
  - **Revisit trigger:** repeated misses on short-token or acronym-heavy tasks during pilot usage.
  - **Exit path:** improve tokenization and/or semantic fallback for short technical terms.

- **Assumption:** The typed model can ship with only `fact`, `decision`, and `episode` operationally active.
  - **Why accepted now:** keeps extraction and recall logic narrow enough to land safely.
  - **User/operator risk:** unresolved architectural questions remain underrepresented, so memory can skew toward "things we know" rather than "things still unclear".
  - **Revisit trigger:** operators start using memory for design work and find that unresolved questions disappear between runs.
  - **Exit path:** activate `openQuestion` with explicit lifecycle and resolution tracking.

- **Assumption:** Conservative auto-save is better than broad capture.
  - **Why accepted now:** avoids polluting memory with noisy or low-quality summaries.
  - **User/operator risk:** useful lessons may never be stored, making memory feel inconsistently helpful.
  - **Revisit trigger:** repeated manual saves for information that should have been auto-captured.
  - **Exit path:** add stronger extraction plus scoring/deduplication rather than keeping the save set tiny.

- **Assumption:** No schema migration layer is acceptable in MVP.
  - **Why accepted now:** schema is still small and Phase 2 storage changes were intentionally deferred.
  - **User/operator risk:** once the schema changes, upgrades can become brittle or destructive.
  - **Revisit trigger:** first non-trivial schema evolution (`sqlite-vec`, new typed fields, indexing changes).
  - **Exit path:** explicit migrations and versioned schema upgrades.

- **Assumption:** Fallback to log snapshots is an acceptable degraded mode.
  - **Why accepted now:** the hub should keep working even where `node:sqlite` is unavailable.
  - **User/operator risk:** degraded recall can be mistaken for full typed memory if the downgrade is not obvious enough.
  - **Revisit trigger:** environments regularly run in fallback mode or operators misread fallback as full memory behavior.
  - **Exit path:** stronger operator signaling or stricter runtime requirement for typed memory.

## Related

- Article review: `ai/design/article-reviews/resume_Claude.txt`
- Article review: `ai/design/article-reviews/resume_Codex.txt`
- Roadmap: `ai/ROADMAP.md`
- Detailed archived roadmap: `ai/design/archive/ROADMAP_DETAILED_20260310.md`
