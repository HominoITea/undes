# Getting Started

Undes Community is a CLI package for evidence-backed AI-generated engineering work.

It is designed for focused tasks where you want an AI-generated candidate, but also need to know what supports it, what remains uncertain, and what should not be merged yet.

## 1. Install

```bash
npm install -g @undes.ai/cli
undes --help
```

Community is distributed through npm. This repository contains documentation, examples, and issue templates.

Community is intended for individual evaluation and limited individual use on your own initiative. See [Community License Scope](license-scope.md).

Current recommended release:

```bash
npm install -g @undes.ai/cli@latest
undes --version
```

Check the currently published version:

```bash
npm view @undes.ai/cli version
```

## 2. Initialize And Configure Model Keys

Undes is BYOK: bring your own model keys.

Run `undes init` in your project first:

```bash
undes init
```

This creates `.ai.env.example` with provider key placeholders. Copy it to
`.ai.env` and replace the placeholders with your own keys:

```bash
cp .ai.env.example .ai.env
# edit .ai.env
```

You only need the providers you choose to use:

```bash
OPENAI_API_KEY=...
CLAUDE_API_KEY=...
GEMINI_API_KEY=...
```

Then load `.ai.env` before a run:

```bash
set -a
source .ai.env
set +a
```

Keep `.ai.env` out of git. Undes is local-first and BYOK: your provider keys
stay on your machine and are used to call the model providers you configure.

## 3. Run A Focused Task

Start with a small, reviewable prompt. You can provide the task in three ways.

Inline prompt:

```bash
undes run --project-path=/path/to/project --prompt="Find why this validator accepts invalid input and propose a minimal fix."
```

Prompt from a file:

```bash
undes run --project-path=/path/to/project --prompt-file=./task.txt
```

Default project prompt:

```bash
# edit .ai/prompts/prompt.txt first
undes run --project-path=/path/to/project
```

If you use `.ai/prompts/prompt.txt`, replace the starter template created by
`undes init`; the starter example is ignored until you edit it.

Good first prompts are narrow:

- one bug;
- one feature slice;
- one file family;
- one review question;
- one migration risk.

## 4. Read The Output

Undes produces a trust artifact, not just a chat answer.

Look for:

- **Concrete Changes**: what the AI proposes or implemented;
- **Grounded Fixes**: claims backed by codebase evidence;
- **Assumed Implementation**: generated code or changes that still need review;
- **Rejected Hypotheses**: ideas the workflow considered but did not trust;
- **Open Questions / Risks**: checks that remain unresolved;
- **Trust verdict**: whether the result is ready to proceed, needs review, or diagnostic.

For high-level progress during a run, use:

```bash
undes run --progress --project-path=/path/to/project --prompt="Review this focused change."
```

Community does not expose full internal verbose output. The older `--verbose`
flag is recognised for compatibility and downgraded to the safe progress view.

## 5. Use The Result

The intended workflow is:

1. Generate a candidate answer.
2. Review the trust signals and open checks.
3. Merge only what is supported.
4. Defer or manually check unresolved items.

Undes is not a replacement for engineering judgment. It is a way to make AI-assisted engineering judgment easier to review.
