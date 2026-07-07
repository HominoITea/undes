# Undes

[![npm](https://img.shields.io/npm/v/@undes.ai/cli?label=community)](https://www.npmjs.com/package/@undes.ai/cli)
[![Local-first](https://img.shields.io/badge/local--first-yes-brightgreen)](community/security-and-privacy.md)
[![BYOK](https://img.shields.io/badge/BYOK-yes-brightgreen)](community/getting-started.md)
[![Pro](https://img.shields.io/badge/Pro-undes.app%2Fpricing-blue)](https://undes.app/pricing)

## Evidence-Checked AI Code

Ündes helps developers know what is safe to merge before trusting AI-generated
code, patches, refactors, or architecture decisions.

It proposes a solution or code candidate, then checks it against visible
evidence, files inspected, assumptions, what could not be proven, critique, open
risks, and a conservative trust verdict.

```bash
npm install -g @undes.ai/cli
cd your-project
undes init
undes run --prompt="Review this change for risky assumptions, missing tests, and unsafe architectural drift."
```

What you get is not just a chat answer. Undes separates the candidate answer
from the evidence and trust boundary around it.

```text
Verdict: Needs review

Evidence:
- The validator rejects expired tokens but does not prove audience validation.
- Existing tests cover malformed tokens, but not cross-tenant tokens.

Rejected hypothesis:
- This is not explained by clock skew; expiry checks are already deterministic.

Open checks:
- Add an audience/tenant test before treating the change as safe to merge.
```

**One prompt -> one evidence-checked candidate with trust boundaries.** AI can
generate the answer; Undes helps you decide whether it is safe to merge.

## Why

AI made code generation cheap. The expensive part is trust:

- What codebase evidence supports the answer?
- Which assumptions did the model make, and which hypotheses did it reject?
- Which risks are still open before merge?
- Is the output a reviewable engineering artifact, or just a confident answer?

Undes makes that trust layer explicit.

## Editions

Undes editions share the same core idea: AI generates an engineering answer, and
Undes makes the trust boundary explicit before you rely on it. The editions differ by
workflow, packaging, and support.

| Edition | For | What it provides | Status |
|---|---|---|---|
| **Community** | Individual developers evaluating Undes or using it independently. | Local-first CLI, BYOK model access, one prompt -> one evidence-checked candidate with trust boundaries, and operator-facing output. | Available as `@undes.ai/cli` |
| **Pro** | Professionals using the paid local workflow. | License-gated local CLI, Pro terminal UI, local history, and native verification package. | See [undes.app/pricing](https://undes.app/pricing) |
| **Team / Enterprise** | Organizations that need a broader commercial arrangement. | Handled through direct discussion. No public package, install path, hosted workflow, or deployment promise is committed in these docs. | Not self-service |

## When Undes Helps

Use Undes when a plain AI answer is not enough and you need a reviewable
decision trail:

- code review where the risk is hidden in assumptions, not syntax;
- bug investigation where several hypotheses look plausible;
- architecture or migration decisions that need explicit open checks;
- validation, auth, billing, or data-flow changes where a confident answer is
  not sufficient;
- local BYOK workflows where repository content should not go to Undes servers.

## Repository Structure

- [`community/`](community/README.md) — Community install notes, command
  reference, license scope, security notes, and release changelog.
- [`pro/`](pro/README.md) — Pro command reference, external CLI setup,
  and public setup notes.
- [`docs/`](docs/community-vs-pro.md) — shared product documentation for the
  core Undes workflow.
- [`articles/`](articles/README.md) — public articles and long-form product
  explanation.
- [`examples/`](examples/README.md) — sanitized examples of generated and
  trust artifacts.

Start with:

- [Community README](community/README.md)
- [Pro README](pro/README.md)
- [Run Pro through Claude Code and Codex CLI](pro/external-cli-setup.md)
- [Community vs Pro](docs/community-vs-pro.md)
- [One-minute demo](docs/demo.md)
- [Examples](examples/README.md)

## What a run produces

An evidence-checked engineering artifact:

- the proposed implementation or diagnostic answer;
- the codebase evidence supporting it;
- assumptions and open checks;
- rejected hypotheses;
- risk notes;
- a trust verdict.

See [the demo walkthrough](docs/demo.md) and the
[sanitized artifact example](examples/generated-and-verified-artifact.md) for
the shape of the output.

## About this repository

This is the public documentation, examples, and feedback surface for
Undes. It is not the product source — Community is installed as a CLI,
and the Pro and Enterprise editions are delivered separately.

## Feedback

Open an issue describing the task you tried and which trust signal you
would have needed before deciding to merge, defer, or reject the result.
