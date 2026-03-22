# Layered Architecture (Hub Scripts)

## Goal
Reduce coupling in `ai/scripts/generate-context.js` by splitting logic into explicit layers:
- `application` - CLI orchestration and workflow pipelines.
- `domain` - pure business logic (scoring, parsing, formatting).
- `infrastructure` - filesystem, provider/network, process adapters.

## Current Layer Mapping

### Application layer
- `ai/scripts/generate-context.js` (main orchestration)
- `ai/scripts/hub.js`
- `ai/scripts/init-project.js`
- `ai/scripts/memory.js`
- `ai/scripts/language-specs.js`

### Domain layer
- `ai/scripts/domain/quality-metrics.js`
- `ai/scripts/domain/discussion-log.js`
- `ai/scripts/domain/prompt-content.js`
- `ai/scripts/prompt-gate.js`
- `ai/scripts/response-validator.js`
- `ai/scripts/refinement.js`
- `ai/scripts/context-pack.js`

### Infrastructure layer
- `ai/scripts/infrastructure/file-read-tool.js`
- `ai/scripts/infrastructure/run-logs.js`
- `ai/scripts/infrastructure/providers.js`
- `ai/scripts/context-index.js`
- `ai/scripts/context-index-treesitter.js`
- `ai/scripts/config-loader.js`
- `ai/scripts/path-utils.js`
- `ai/scripts/checkpoint-manager.js`

## Rules for New Changes
1. New pure logic goes to `domain/*`.
2. New FS/OS/provider adapters go to `infrastructure/*`.
3. `generate-context.js` should only orchestrate and call layer modules.
4. Keep CLI entry paths stable (`npm run undes:*`) while refactoring internals.

## Completed in this iteration
- Extracted confidence/agreement/revision policy to `domain/quality-metrics.js`.
- Extracted discussion rendering to `domain/discussion-log.js`.
- Extracted prompt builders/parsers and end-marker helpers to `domain/prompt-content.js`.
- Extracted secure file-read tool to `infrastructure/file-read-tool.js`.
- Extracted runtime log writers to `infrastructure/run-logs.js`.
- Extracted provider API clients to `infrastructure/providers.js`.
- Switched `generate-context.js` to consume new modules.

## Next Recommended Splits
1. Split `runAgents` workflow into `application/pipeline/*` steps (preprocess/proposals/critiques/consensus/postprocess).
