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

Undes is planned in three editions. They share the same local
verification core — the difference is workflow, collaboration, and
deployment, not a stronger or weaker verifier.

| Edition | For | Status |
|---|---|---|
| **Community** | Individual developers. Free, local-first CLI: the full generate-and-verify loop on your own machine, with your own provider keys (BYOK). | In preparation |
| **Pro** | Professional and small-team use. Adds workflow integrations, configurable run policy, team metrics, and hardened modules. | Planned |
| **Enterprise** | Organizations. Adds self-hosted deployment, governance, RBAC, audit retention, and support. | Planned |

## Versions

- **Community** — [overview, documentation, and getting started »](https://github.com/HominoITea/undes/tree/community). The npm package is being prepared for release.
- **Pro** — planned; not yet available.
- **Enterprise** — planned; not yet available.

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
