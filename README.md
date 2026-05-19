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
workflow, collaboration, deployment, and support.

| Edition | For | What it provides | Status |
|---|---|---|---|
| **Community** | Individual developers evaluating Undes or using it independently. | Local-first CLI, BYOK model access, one prompt -> one verified answer, and operator-facing artifacts. | In preparation |
| **Pro** | Professionals and teams that want Undes in regular engineering work. | Licensed workflow features for regular professional/team use. | Not publicly available |
| **Enterprise** | Organizations with governance, security, and deployment requirements. | Organization deployment, governance, audit, and support options. | Not publicly available |

## Versions

- **Community** — public documentation, installation notes, examples, and
  license scope are maintained in the
  [`community`](https://github.com/HominoITea/undes/tree/community) branch. The
  npm package is being prepared for release.
- **Pro** — paid edition for regular professional/team use; not publicly
  available.
- **Enterprise** — paid edition for governed organization deployment; not
  publicly available.

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
