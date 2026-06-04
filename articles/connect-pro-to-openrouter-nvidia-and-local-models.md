# Connecting Pro to OpenRouter, NVIDIA NIM, and Local Models

The Community edition of Undes runs on the three first-party cloud providers:
OpenAI, Anthropic, and Google. That keeps the free tool simple and easy to
support.

Pro removes that limit. With a Pro license you can point any agent at an
**OpenAI-compatible** provider — an aggregator like OpenRouter, a hosted catalog
like NVIDIA NIM, or a model running on your own machine through Ollama, LM
Studio, or llama.cpp.

This guide shows how to wire those up, and — just as important — how Undes keeps
a weak or unverified model from quietly degrading your results.

## How an agent declares a provider

Agents live in `ai/agents.json`. A first-party agent looks like this:

```json
{
  "name": "developer",
  "role": "Developer",
  "apiUrl": "https://api.openai.com/v1/chat/completions",
  "key": "OPENAI_API_KEY",
  "model": "gpt-5.4"
}
```

To use an OpenAI-compatible provider, add two fields: `provider` set to
`"openai-compatible"` and `providerFlavor` naming the flavor. `key` is the **name
of the environment variable** that holds the API key, not the key itself.

If you configure an `openai-compatible` agent in Community, the run stops before
any network call with a clear "requires Pro" message — nothing is sent.

## OpenRouter

OpenRouter is an aggregator: one endpoint and one API key in front of many
underlying models.

```json
{
  "name": "reviewer",
  "role": "Reviewer",
  "provider": "openai-compatible",
  "providerFlavor": "openrouter",
  "apiUrl": "https://openrouter.ai/api/v1/chat/completions",
  "key": "OPENROUTER_API_KEY",
  "model": "anthropic/claude-sonnet-4.5",
  "headers": {
    "HTTP-Referer": "https://your.site",
    "X-Title": "Your App"
  }
}
```

The `headers` block is optional. OpenRouter uses `HTTP-Referer` and `X-Title`
for attribution; set them to your own identity, or omit them entirely.

## NVIDIA NIM

NVIDIA's hosted API is OpenAI-compatible:

```json
{
  "name": "developer",
  "role": "Developer",
  "provider": "openai-compatible",
  "providerFlavor": "nvidia-nim",
  "apiUrl": "https://integrate.api.nvidia.com/v1/chat/completions",
  "key": "NVIDIA_API_KEY",
  "model": "nvidia/llama-3.1-nemotron-nano-8b-v1"
}
```

The hosted endpoint is cloud traffic. If you run a NIM container yourself, point
`apiUrl` at it and add `"local": true` so Undes treats it as on-machine.

## Local models: Ollama, LM Studio, llama.cpp

Local servers speak the same protocol on `localhost`. Use the matching flavor:

```json
{
  "name": "developer",
  "role": "Developer",
  "provider": "openai-compatible",
  "providerFlavor": "ollama",
  "apiUrl": "http://localhost:11434/v1/chat/completions",
  "key": "OLLAMA_API_KEY",
  "model": "qwen3:8b"
}
```

- **Ollama** — `http://localhost:11434/v1/chat/completions`
- **LM Studio** — `http://localhost:1234/v1/chat/completions`
- **llama.cpp** server — your configured host and port

Local servers usually ignore the API key, but the `key` field is still required
in the schema. Point it at any environment variable (it is sent in the auth
header and ignored by the server).

For an endpoint that is OpenAI-compatible but not on this list, use
`"providerFlavor": "generic"` and set `"local": true` if it runs on your machine.

## The part most tools skip: is the model fit for the job?

A multi-agent workflow only adds trust when the model doing the work is good
enough for that step. A small local model is fine for classification or a first
draft; letting it run the **consensus** or **revision** step — where it decides
what the final answer is — can quietly corrupt the result.

So Undes assigns every model a qualification status. First-party frontier models
(GPT-5, Claude, Gemini) default to **trusted**. Everything reached through an
aggregator or a local server defaults to **unqualified** — not because it is bad,
but because Undes cannot verify from the outside what the endpoint actually
serves.

An unqualified model is allowed to run low- and (with a warning) medium-trust
phases, but it is kept off the trust-critical synthesis phases until you clear
it. The guard runs before any model call:

- `runtimePolicy.modelGuard: "warn"` (default) — surfaces a warning, never blocks.
- `"strict"` — refuses the run until every agent is cleared.
- `"off"` — no guard.

To clear a model, declare its status in `.ai/model-capabilities.json`:

```json
{
  "qwen3:8b": { "qualificationStatus": "trusted" }
}
```

Use `"qualified-medium"` to allow it on proposal/critique/approval but still keep
it off final synthesis. This file is your explicit decision; Undes honors it.

## See what is configured before you run

`undes-pro doctor` prints a "Provider data flow" section that lists every agent,
where its prompts go, whether they leave the machine, and its trust status:

```
Provider data flow:
  developer [openai-compatible/openrouter] → OpenRouter → underlying provider (leaves machine) · trust: trusted
  drafter   [openai-compatible/ollama] → localhost:11434 (local — stays on machine) · trust: unqualified
```

That one view tells you what you are sending where, and which models still need
a decision before they touch a trust-critical step.

## Keeping data on your machine

If you configured a local model specifically so nothing leaves your machine, make
it a guarantee rather than a hope. Set:

```sh
export UNDES_NO_NETWORK=1
```

With that set, Undes refuses any agent whose prompts would leave the machine —
including a cloud fallback — before the request is made. Only local agents run.

## Summary

- Add `provider: "openai-compatible"` and a `providerFlavor` to an agent in
  `ai/agents.json` to use OpenRouter, NVIDIA NIM, or a local server.
- Aggregator and local models start **unqualified** and stay off trust-critical
  phases until you clear them in `.ai/model-capabilities.json`.
- `undes-pro doctor` shows data flow and trust at a glance.
- `UNDES_NO_NETWORK=1` is a hard local-only guarantee.

The point is not just "more providers." It is more providers without losing the
trust posture that makes a multi-agent answer worth more than a single guess.
