# Getting Started

Undes Community is a CLI package for generated-and-verified AI engineering work.

It is designed for focused tasks where you want an AI-generated answer, but also need to know what supports it, what remains uncertain, and what should not be merged yet.

## 1. Install

```bash
npm install -g @undes/cli
undes --help
```

Community is distributed through npm. This repository contains documentation, examples, and issue templates.

## 2. Configure Model Keys

Undes is BYOK: bring your own model keys.

Configure the model providers you want to use. A typical setup looks like:

```bash
export OPENAI_API_KEY=...
export ANTHROPIC_API_KEY=...
export GOOGLE_API_KEY=...
```

You only need the providers you choose to use.

## 3. Run A Focused Task

Start with a small, reviewable prompt:

```bash
undes run --project-path=/path/to/project --prompt="Find why this validator accepts invalid input and propose a minimal fix."
```

Good first prompts are narrow:

- one bug;
- one feature slice;
- one file family;
- one review question;
- one migration risk.

## 4. Read The Output

Undes produces an engineering artifact, not just a chat answer.

Look for:

- **Concrete Changes**: what the AI proposes or implemented;
- **Grounded Fixes**: claims backed by codebase evidence;
- **Assumed Implementation**: generated code or changes that still need review;
- **Rejected Hypotheses**: ideas the workflow considered but did not trust;
- **Open Questions / Risks**: checks that remain unresolved;
- **Trust status**: whether the result is patch-safe or diagnostic.

## 5. Use The Result

The intended workflow is:

1. Generate a candidate answer.
2. Review the trust signals.
3. Merge only what is supported.
4. Defer or manually check unresolved items.

Undes is not a replacement for engineering judgment. It is a way to make AI-assisted engineering judgment easier to review.
