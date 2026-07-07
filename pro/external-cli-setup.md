# Run Undes Pro Through Claude Code And Codex CLI

Undes normally calls model providers through API configuration. The Pro
`external-cli` provider lets selected agents run through a vendor CLI that is
already installed and logged in on your machine: Claude Code (`claude`) or Codex
CLI (`codex`).

This does not give Undes another provider API key. Undes runs the official local
binary as a bounded subprocess, passes the prompt through stdin, and records a
redacted receipt for the run. It does not read or copy the CLI credential store.

## When To Use This

Use this setup when you already use Claude Code or Codex CLI locally and want
those tools inside the Undes evidence-checking workflow.

The strongest setup is cross-model:

- Codex CLI for proposal and implementation roles.
- Claude Code for design review, critique, and risk analysis roles.

Single-CLI mode is supported, but it is weaker because one model is effectively
reviewing its own blind spots. Undes still records evidence, assumptions,
rejected hypotheses, open checks, and a trust verdict, but cross-model checking
is stronger.

## Prerequisites

1. Install and license Undes Pro.

   ```bash
   npm install -g @undes.ai/cli-pro
   undes-pro license activate <your-license-key>
   ```

2. Install and sign in to the vendor CLI directly.

   ```bash
   claude --version
   codex --version
   ```

3. Confirm the binaries are reachable on `PATH` in the same shell where you run
   `undes-pro`.

## Agent Configuration

Agents are configured in `ai/agents.json`. An API-backed agent usually has an
endpoint and key reference:

```json
{
  "name": "reviewer",
  "role": "Reviewer",
  "capabilities": ["code-review", "risk-analysis"],
  "apiUrl": "https://api.anthropic.com/v1/messages",
  "key": "CLAUDE_API_KEY",
  "model": "claude-sonnet-4-6"
}
```

The same role can be backed by Claude Code CLI:

```json
{
  "name": "reviewer",
  "role": "Reviewer",
  "capabilities": ["code-review", "risk-analysis"],
  "provider": "external-cli",
  "providerFlavor": "claude-code",
  "command": "claude",
  "args": ["-p"],
  "model": "claude-code-default",
  "authSource": "installed-cli-session",
  "timeoutMs": 180000,
  "contextBudget": 28000
}
```

An implementation role can be backed by Codex CLI:

```json
{
  "name": "implementer",
  "role": "Implementation Engineer",
  "capabilities": ["implementation", "code-generation"],
  "provider": "external-cli",
  "providerFlavor": "codex-cli",
  "command": "codex",
  "args": ["exec", "--json", "-"],
  "model": "codex-default",
  "authSource": "installed-cli-session",
  "timeoutMs": 240000,
  "contextBudget": 28000
}
```

## Field Reference

| Field | Meaning |
|---|---|
| `provider` | Use `external-cli` to select the CLI adapter. |
| `providerFlavor` | `claude-code` or `codex-cli`. |
| `command` | Binary to run, usually `claude` or `codex`. |
| `args` | CLI arguments. Defaults are flavor-specific if omitted. |
| `model` | Receipt/routing label. The real model is controlled by the installed CLI session. |
| `authSource` | Use `installed-cli-session` to document the auth boundary. |
| `timeoutMs` | Wall-clock timeout for the CLI call. |
| `apiUrl` / `key` | Omit these for external CLI-backed agents. |

Default commands:

| Flavor | Default command |
|---|---|
| `claude-code` | `claude -p` |
| `codex-cli` | `codex exec --json -` |

## Route Only One Phase

You can route only one phase through an installed CLI by using
`phaseModelRouting` in `ai/context.json`.

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

This lets you keep most agents on API providers while moving one review or
implementation phase to a local CLI-backed role.

## Verify

Run:

```bash
undes-pro doctor
```

The doctor output shows configured providers and data-flow classification for
the agents Undes can see.

After a run, inspect the run directory for `external-cli-receipts/`. Receipts
are redacted and contain metadata such as command, version when available,
duration, exit status, and digests.

## Gemini

Gemini CLI is not documented as an external CLI flavor for Undes Pro. Use Gemini
through an explicit API or Vertex-backed provider path instead. That keeps the
authorization boundary explicit and lets Gemini-backed agents participate in the
same run through normal provider routing.

## Safety Boundary

- The prompt is passed as stdin data, not interpolated into a shell command.
- The child process is bounded by timeout and output limits.
- The child process receives a curated environment instead of provider API keys.
- Receipts are redacted and store digests rather than raw prompt/output content.
- The provider is classified as leaving the machine, because the vendor CLI may
  contact its own service.

This feature is a local integration boundary. It does not make a vendor CLI
offline. It lets Undes use the official CLI the developer already installed
without requiring a separate provider API key for that role.
