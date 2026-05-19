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
npm install -g @undes/cli
undes --help
```

## What You Get

A typical Undes run produces a generated-and-verified engineering artifact:

- proposed implementation or diagnostic answer;
- codebase evidence used to support the answer;
- assumptions and open checks;
- rejected hypotheses;
- risk notes;
- trust/patch-safety status.

The goal is not to fight coding assistants. The goal is to make AI-generated engineering answers more useful and trustworthy.

## Documentation

- [Getting Started](docs/getting-started.md)
- [How Undes Works](docs/how-it-works.md)
- [Community CLI](docs/community-cli.md)
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
