# Agent And Model Routing

Undes runs a structured engineering workflow. Different agents can participate
in different phases, and each phase can use different model settings.

This page describes the public configuration surface:

- how agents declare their capabilities;
- how phases select agents;
- how to route a specific phase to a different model or provider;
- how sequential and parallel execution are controlled.

It does not describe internal prompt templates or private pipeline heuristics.

## Agent Inventory

Agents are declared in `ai/agents.json`. Each entry names one agent, the model
it uses, and the capabilities it can provide.

Typical fields:

```json
{
  "name": "developer",
  "role": "Developer",
  "description": "Practical implementation plus validation and test-oriented review",
  "apiUrl": "https://api.openai.com/v1/chat/completions",
  "key": "OPENAI_API_KEY",
  "model": "gpt-5.4",
  "capabilities": [
    "implementation-analysis",
    "implementation-review",
    "change-design",
    "test-validation",
    "patch-validation"
  ],
  "contextBudget": 28000,
  "maxOutputTokens": 12000,
  "disableTimeout": true
}
```

Important fields:

| Field | Meaning |
|---|---|
| `name` | Stable agent identifier used by routing config. |
| `role` / `description` | Human-readable role metadata. |
| `apiUrl` | Provider endpoint used by this agent. Community supports the documented first-party cloud providers. |
| `key` | Environment variable name containing the provider API key. |
| `model` | Model name passed to the provider. |
| `capabilities` | Tags used by the workflow to select the agent for phases. |
| `contextBudget` | Approximate context budget used when building phase input. |
| `maxOutputTokens` | Default output budget for that agent. |
| `disableTimeout` | Whether the request timeout guard is disabled for this agent. |

Agent names are convenient for direct targeting. Capabilities are better for
portable policies because they describe what the agent is expected to do rather
than which provider currently runs it.

## Default Capability Map

The default scaffold uses capabilities like these:

| Capability | Typical use |
|---|---|
| `prompt-clarification` | Clarify ambiguous requests before the main run. |
| `prompt-decomposition` | Break a broad task into narrower engineering work. |
| `task-classification` | Classify task shape and complexity. |
| `design-analysis` | Propose architecture, boundaries, and trade-offs. |
| `design-review` | Challenge architecture and integration choices. |
| `seam-investigation` | Inspect boundaries between changed and dependent code. |
| `implementation-analysis` | Propose practical implementation details. |
| `implementation-review` | Review implementation risk and missing checks. |
| `change-design` | Shape a focused change plan. |
| `consistency-review` | Look for contradictions, missed evidence, and drift. |
| `approval-review` | Decide whether the answer is grounded enough to accept. |
| `risk-challenge` | Raise risk, rollback, and operational concerns. |
| `adversarial-review` | Run a devil's advocate pass. |
| `counterexample-analysis` | Search for cases that break the proposed answer. |
| `test-validation` | Check test strategy and verification gaps. |
| `patch-validation` | Check whether a proposed patch is safe enough to apply. |
| `final-synthesis` | Produce the final engineering artifact. |
| `diagnostic-synthesis` | Produce a diagnostic result when the run cannot be patch-safe. |

You can add your own capability tags, but phase selection only uses tags that
you reference from `pipelinePolicy`.

## Workflow Phases

The exact run can vary by task, evidence, and trust gates, but the public phase
families are:

| Phase family | Purpose |
|---|---|
| `preProcess` | Optional prompt clarification / decomposition before the main debate. |
| `proposal` | Agents propose a solution, diagnosis, or implementation direction. |
| `critique` | Other agents challenge proposals and request missing evidence. |
| `consensus` | A synthesizer builds a single engineering artifact from the debate. |
| `approval` | Review agents check whether the answer is sufficiently grounded. |
| `revision` | The synthesizer revises the answer after approval feedback. |
| `devilsAdvocate` | Adversarial review for hidden assumptions and failure modes. |
| `daRevision` | Revision after devil's advocate feedback. |
| `deltaRevision` | Late revision when final evidence changes the answer. |
| `postProcess` | Optional test / patch validation pass. |
| `refinement` | Follow-up refinement when the operator asks to revise a prior answer. |

Seam expansion is a second pass used when the workflow needs more evidence from
adjacent files or integration points. It has its own routing keys:

- `seamExpansionProposal`
- `seamExpansionCritique`
- `seamExpansionApproval`
- `seamExpansionConsensus`
- `seamExpansionRevision`

Not every run executes every phase. Some phases are skipped when the task does
not need them or when a gate decides there is not enough evidence to continue
patch-safely.

## Selecting Agents Per Phase

Phase participation is configured in `ai/context.json` under
`pipelinePolicy`.

A phase can select agents by capability:

```json
{
  "pipelinePolicy": {
    "debatePhases": {
      "proposal": {
        "capabilities": [
          "design-analysis",
          "implementation-analysis"
        ]
      },
      "critique": {
        "capabilities": [
          "design-review",
          "implementation-review"
        ]
      },
      "approval": {
        "capabilities": [
          "approval-review",
          "implementation-review"
        ]
      }
    }
  }
}
```

Or by direct agent name:

```json
{
  "pipelinePolicy": {
    "debatePhases": {
      "proposal": {
        "agents": ["architect", "developer"]
      },
      "critique": {
        "agents": ["reviewer"]
      }
    },
    "consensus": {
      "agent": "synthesizer"
    }
  }
}
```

If both `agents` and `capabilities` are present, Undes uses the union and
deduplicates by agent name.

If a phase has neither `agents` nor `capabilities`, it falls back to the
available debate agent pool. If a phase names agents or capabilities that match
nothing, that phase has no participating agents.

## Special Phase Aggregation

Special phases can run more than one agent and then aggregate their outputs.
This is configured under `pipelinePolicy.specialPhases`.

```json
{
  "pipelinePolicy": {
    "specialPhases": {
      "preProcessAgents": {
        "capabilities": [
          "prompt-clarification",
          "prompt-decomposition"
        ],
        "aggregationMode": "aggregate"
      },
      "devilsAdvocateAgents": {
        "capabilities": [
          "adversarial-review"
        ],
        "aggregationMode": "single-best"
      },
      "postProcessAgents": {
        "capabilities": [
          "test-validation",
          "patch-validation"
        ],
        "aggregationMode": "aggregate"
      }
    }
  }
}
```

Supported aggregation modes:

| Mode | Meaning |
|---|---|
| `aggregate` | Keep and summarize all successful special-phase outputs. |
| `single-first` | Run only the first selected agent for that special phase. |
| `single-best` | Run selected agents and let the special-phase aggregator choose the strongest result. |

Use `single-first` when cost or rate limits matter more than redundancy. Use
`aggregate` or `single-best` when the phase is trust-critical.

## Routing Models Per Phase

`ai/agents.json` defines the default model for each agent. To use a different
model or provider for one phase, set `phaseModelRouting` in `ai/context.json`.

Example: use a cheaper reviewer model for critique, but keep a stronger model
for final synthesis.

```json
{
  "phaseModelRouting": {
    "critique": {
      "reviewer": {
        "model": "gemini-3.1-flash",
        "maxOutputTokens": 4096
      }
    },
    "consensus": {
      "synthesizer": {
        "model": "gpt-5.4",
        "maxOutputTokens": 8192
      }
    }
  }
}
```

Example: route a phase to a different provider endpoint and API-key variable.

```json
{
  "phaseModelRouting": {
    "approval": {
      "reviewer": {
        "apiUrl": "https://api.anthropic.com/v1/messages",
        "key": "CLAUDE_API_KEY",
        "model": "claude-sonnet-4-6",
        "contextBudget": 28000,
        "maxOutputTokens": 4096
      }
    }
  }
}
```

Supported routing keys:

| Key | Notes |
|---|---|
| `apiUrl` | Provider endpoint for this phase only. |
| `model` | Model name for this phase only. |
| `key` | Environment variable name for the provider API key. |
| `contextBudget` | Context budget override. |
| `maxOutputTokens` | Output token override. |
| `disableTimeout` | Boolean timeout override. |
| `requestTimeoutMultiplier` | Positive timeout multiplier. |
| `provider` | Pro-only provider override, including `external-cli`. |
| `providerFlavor` | Pro-only provider flavor, for example `claude-code` or `codex-cli`. |
| `command` | Pro-only external CLI binary override. |
| `args` | Pro-only external CLI argument override. |
| `authSource` | Pro-only external CLI auth label, usually `installed-cli-session`. |
| `timeoutMs` | Pro-only external CLI wall-clock timeout. |

Supported `phaseModelRouting` stage keys:

```text
preProcess
proposal
critique
approval
consensus
revision
devilsAdvocate
daRevision
deltaRevision
postProcess
refinement
seamExpansionProposal
seamExpansionCritique
seamExpansionApproval
seamExpansionConsensus
seamExpansionRevision
```

`phaseModelRouting` changes the model settings for an already-selected agent.
It does not by itself add that agent to a phase. Use `pipelinePolicy` for
participation and `phaseModelRouting` for per-phase model/provider overrides.

### Pro: Route A Phase Through An Installed CLI

Undes Pro can route selected agents through a locally installed Claude Code or
Codex CLI session with the `external-cli` provider. This is useful when a
developer already uses those vendor CLIs locally and wants the result inside the
same evidence, critique, open-check, and trust-verdict workflow.

Example: route only the review phase to Claude Code CLI.

```json
{
  "phaseModelRouting": {
    "critique": {
      "reviewer": {
        "provider": "external-cli",
        "providerFlavor": "claude-code",
        "command": "claude",
        "args": ["-p"],
        "model": "claude-code-default",
        "authSource": "installed-cli-session",
        "timeoutMs": 180000
      }
    }
  }
}
```

The CLI must already be installed, logged in, and reachable on `PATH`. Undes
does not read or copy the CLI credential store; it runs the official local
binary as a bounded subprocess and records redacted receipts for the run.

See the full Pro setup guide: [Run Undes Pro through Claude Code and Codex
CLI](../pro/external-cli-setup.md).

## Sequential And Parallel Execution

The phase order is controlled by the Undes workflow. In normal Community usage,
you do not manually reorder major phases: proposal happens before critique,
critique before synthesis, and so on.

Within a phase, multiple selected agents may run in parallel. Execution is
provider-aware:

| Provider group | Default execution mode |
|---|---|
| Anthropic | sequential |
| Google | parallel |
| OpenAI | parallel |
| Other | parallel |

This default protects providers that are more likely to hit rate limits while
still allowing independent provider groups to run concurrently.

You can override provider execution mode with environment variables:

```bash
# Run OpenAI-backed agents one at a time
AI_CFG__PROVIDER__OPENAI__EXECUTION=sequential

# Let Anthropic-backed agents run in parallel
AI_CFG__PROVIDER__ANTHROPIC__EXECUTION=parallel

# Default for providers without a specific override
AI_CFG__DEFAULT__PROVIDER_EXECUTION=sequential
```

Compatibility aliases are also accepted:

```bash
AI_PROVIDER_OPENAI_EXECUTION=sequential
AI_PROVIDER_ANTHROPIC_EXECUTION=parallel
```

Use sequential mode when you see provider rate-limit failures or want easier
debugging. Use parallel mode when latency matters and the provider/account can
handle concurrent requests.

## Practical Recipes

### Reduce Cost For Small Tasks

Use fewer agents in proposal and critique:

```json
{
  "pipelinePolicy": {
    "debatePhases": {
      "proposal": {
        "agents": ["developer"]
      },
      "critique": {
        "agents": ["reviewer"]
      },
      "approval": {
        "agents": ["reviewer"]
      }
    },
    "consensus": {
      "agent": "synthesizer"
    }
  }
}
```

### Make Review More Adversarial

Add explicit adversarial review while keeping the normal debate phases:

```json
{
  "pipelinePolicy": {
    "specialPhases": {
      "devilsAdvocateAgents": {
        "capabilities": ["adversarial-review", "counterexample-analysis"],
        "aggregationMode": "single-best"
      }
    }
  }
}
```

### Use A Stronger Model Only For Synthesis

Keep earlier phases cheaper, then spend budget on the final artifact:

```json
{
  "phaseModelRouting": {
    "consensus": {
      "synthesizer": {
        "model": "gpt-5.4",
        "maxOutputTokens": 8192
      }
    },
    "revision": {
      "synthesizer": {
        "model": "gpt-5.4",
        "maxOutputTokens": 8192
      }
    }
  }
}
```

## Additional Providers (Pro)

Community runs on the first-party cloud providers (OpenAI, Anthropic, Google).
Pro also routes agents to OpenAI-compatible providers via two extra fields on an
agent: `provider: "openai-compatible"` and a `providerFlavor`.

| Flavor | Endpoint | Notes |
|---|---|---|
| `openrouter` | `https://openrouter.ai/api/v1/chat/completions` | Aggregator; `headers` can carry `HTTP-Referer` / `X-Title`. |
| `nvidia-nim` | `https://integrate.api.nvidia.com/v1/chat/completions` | Hosted (cloud); a NIM on a loopback host (`localhost`) is treated as local. |
| `ollama` / `lmstudio` / `llamacpp` | local `http://localhost:...` | Local model servers; on-machine when the URL is a loopback host. |
| `generic` | any OpenAI-compatible URL | On-machine only when the URL is a loopback host (`localhost` / `127.0.0.1`). |

Models reached through an aggregator or a local server default to **unqualified**,
so they are kept off trust-critical phases (consensus / revision / devil's
advocate) until you clear them in `.ai/model-capabilities.json`. The model guard
is `runtimePolicy.modelGuard` (`warn` default / `strict` / `off`). `undes-pro
doctor` shows each agent's data flow and trust posture, and `UNDES_NO_NETWORK=1`
refuses any agent whose prompts would leave the machine — only a loopback endpoint
counts as on-machine, never an arbitrary URL with a `local` flag.

Configuring an `openai-compatible` agent in Community is refused before any
network call with a "requires Pro" message.

Full guide:
[Connecting Pro to OpenRouter, NVIDIA NIM, and Local Models](../articles/connect-pro-to-openrouter-nvidia-and-local-models.md).

## Guardrails

- Keep provider API keys in `.ai.env`, not in `ai/agents.json`.
- Prefer capability-based routing for portability.
- Use direct agent names when you need exact control.
- Keep Community provider configuration aligned with documented Community
  provider support.
- Do not route every phase to the largest model by default. The workflow is
  designed so cheaper phases can produce useful challenge and evidence before a
  stronger synthesis phase.
- Treat a diagnostic output as a valid result: it means the workflow did not
  find enough evidence to mark the answer patch-safe.
