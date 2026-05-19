# Undes

Undes is a local-first AI engineering CLI that generates code and engineering solutions, then verifies the generated answer before a team trusts it.

It is not another chat wrapper. Undes runs a structured engineering workflow around the answer: proposal, critique, evidence checks, risk review, open checks, and a final artifact that separates what is supported from what is still uncertain.

## Why

AI coding tools made generation cheap. The expensive part moved to trust:

- What evidence from the codebase supports the answer?
- Which assumptions did the model make?
- Which hypotheses were rejected?
- Which risks remain open before merge?
- Is the output a reviewable engineering artifact or just a confident chat answer?

Undes exists to make that trust layer explicit.

## Install

Community is distributed as an npm package. This repository contains documentation, examples, and issue templates.

```bash
npm install -g @undes.ai/cli
undes --help
```

Initialize Undes inside your project:

```bash
undes init
```

`undes init` creates `.ai.env.example`. Copy it to `.ai.env` and replace the
placeholders with your own provider keys:

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

Keep `.ai.env` out of git.

Run a task with one of the supported prompt input styles:

```bash
# Inline prompt
undes run --prompt="Find why this validator accepts invalid input and propose a minimal fix."

# Prompt from a file
undes run --prompt-file=./task.txt

# Default project prompt
# edit .ai/prompts/prompt.txt, then run:
undes run
```

If you use `.ai/prompts/prompt.txt`, replace the starter template created by
`undes init`; the starter example is ignored until you edit it.

## What You Get

A typical Undes run produces a generated-and-verified engineering artifact:

- proposed implementation or diagnostic answer;
- codebase evidence used to support the answer;
- assumptions and open checks;
- rejected hypotheses;
- risk notes;
- trust/patch-safety status.

The goal is not to fight coding assistants. The goal is to make AI-generated engineering answers more useful and trustworthy.

## Community License Scope

Community is free for personal learning, individual evaluation, research, experimentation, prototypes, and limited individual use on your own initiative.

You may use it individually even while working on a commercial product, provided Undes is not adopted as part of a team, company, client, CI/CD, or managed development process.

Regular team/company use, client delivery, CI/CD, production workflow use, and organization-managed workflows require a separate paid license.

## Documentation

- [Getting Started](docs/getting-started.md)
- [How Undes Works](docs/how-it-works.md)
- [Community CLI](docs/community-cli.md)
- [Community License Scope](docs/community-license-scope.md)
- [Use Cases](docs/use-cases.md)
- [Artifacts](docs/artifacts.md)
- [Example Artifact](examples/generated-and-verified-artifact.md)
- [FAQ](docs/faq.md)
- [Security And Privacy](docs/security-and-privacy.md)
- [Articles](articles/README.md)

## Repository Contents

This repository contains public documentation, examples, articles, issue templates, and installation guidance.

The CLI is installed from npm.

## Feedback

Open an issue with:

- the task type you tried;
- what trust signal was missing;
- whether the final artifact helped you decide what to merge, defer, or reject.
