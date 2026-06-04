# Community CLI

Community is the command-line package for Undes.

## Install

```bash
npm install -g @undes.ai/cli
undes --help
```

Current recommended release:

```bash
npm install -g @undes.ai/cli@latest
undes --version
```

Expected version:

```text
0.1.3
```

## Model Keys

Undes Community is BYOK. Run `undes init` inside your project first:

```bash
undes init
```

It creates `.ai.env.example`. Copy it to `.ai.env` and replace the placeholders
with your own provider keys:

```bash
cp .ai.env.example .ai.env
# edit .ai.env
```

Use only the providers you choose to run:

```bash
OPENAI_API_KEY=...
CLAUDE_API_KEY=...
GEMINI_API_KEY=...
```

Load `.ai.env` before running Undes and do not commit that file.

## Expected Use

Run Undes on a small repository or focused task first:

```bash
undes run --project-path=/path/to/project --prompt="Implement a small validated change and explain the remaining risks"
```

Prompt input options:

```bash
# Inline prompt
undes run --project-path=/path/to/project --prompt="Review this migration risk."

# Prompt from a file
undes run --project-path=/path/to/project --prompt-file=./task.txt

# Default project prompt
# edit .ai/prompts/prompt.txt first
undes run --project-path=/path/to/project
```

The `.ai/prompts/prompt.txt` file is created by `undes init`. Replace the
starter template before using it; the starter example is ignored until edited.

Progress output:

```bash
undes run --project-path=/path/to/project --progress --prompt="Review this migration risk."
```

`--progress` shows high-level run progress without internal pipeline details.
The old `--verbose` flag is recognised for compatibility and downgraded to the
same safe progress view in Community.

For first runs, prefer a prompt that can be checked in one sitting:

```text
Find why this validation path accepts invalid input. Propose a minimal fix and tests, and clearly mark any open assumptions.
```

## Community Scope

Community provides the core product workflow:

- local-first execution;
- bring your own model keys;
- generated-and-verified engineering artifacts;
- basic trust diagnostics.

Community is free for individual evaluation and limited individual use on your own initiative. Managed team/company/client/CI/CD use requires a separate paid license; see [undes.app/pricing](https://undes.app/pricing).

## Related Docs

- [Getting Started](getting-started.md)
- [Agent And Model Routing](../docs/agent-and-model-routing.md)
- [Community vs Pro](../docs/community-vs-pro.md)
- [Pro CLI](../pro/cli.md)
- [Community License Scope](license-scope.md)
- [Artifacts](../docs/artifacts.md)
- [Use Cases](../docs/use-cases.md)
- [FAQ](../docs/faq.md)
