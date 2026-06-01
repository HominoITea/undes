# Undes

Undes is a local-first AI engineering tool. It does not just generate an
answer — it generates one and then verifies it: the supporting evidence
from your codebase, the assumptions made, the hypotheses rejected, the
risks still open, and a final trust verdict.

**One prompt → one verified answer.** AI generates; Undes verifies it
before your team trusts it.

## Why

AI made code generation cheap. The expensive part is trust:

- What codebase evidence supports the answer?
- Which assumptions did the model make, and which hypotheses did it reject?
- Which risks are still open before merge?
- Is the output a reviewable engineering artifact, or just a confident answer?

Undes makes that trust layer explicit.

## Editions

Undes editions share the same core idea: AI generates an engineering answer, and
Undes verifies the answer before you rely on it. The editions differ by
workflow, packaging, and support.

| Edition | For | What it provides | Status |
|---|---|---|---|
| **Community** | Individual developers evaluating Undes or using it independently. | Local-first CLI, BYOK model access, one prompt -> one verified answer, and operator-facing artifacts. | Available as `@undes.ai/cli` |
| **Pro** | Professionals using the paid local workflow. | License-gated local CLI, Pro terminal UI, local history, and native verification package. | Early access as `@undes.ai/cli-pro@pro-beta` |
| **Team / Enterprise** | Organizations that need a broader commercial arrangement. | Handled through direct discussion. No public package, install path, hosted workflow, or deployment promise is committed in these docs. | Not self-service |

## Repository Structure

- [`community/`](community/README.md) — Community install notes, command
  reference, license scope, security notes, and release changelog.
- [`pro/`](pro/README.md) — Pro command reference and public setup notes.
- [`docs/`](docs/community-vs-pro.md) — shared product documentation for the
  core Undes workflow.
- [`articles/`](articles/README.md) — public articles and long-form product
  explanation.
- [`examples/`](examples/README.md) — sanitized examples of generated and
  verified artifacts.

Start with:

- [Community README](community/README.md)
- [Pro README](pro/README.md)
- [Community vs Pro](docs/community-vs-pro.md)

## What a run produces

A generated-and-verified engineering artifact:

- the proposed implementation or diagnostic answer;
- the codebase evidence supporting it;
- assumptions and open checks;
- rejected hypotheses;
- risk notes;
- a trust / patch-safety verdict.

## About this repository

This is the public documentation, examples, and feedback surface for
Undes. It is not the product source — Community is installed as a CLI,
and the Pro and Enterprise editions are delivered separately.

## Feedback

Open an issue describing the task you tried and which trust signal you
would have needed before deciding to merge, defer, or reject the result.
