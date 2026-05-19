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
| **Community** | Individual developers evaluating Undes or using it independently. | Local-first CLI, BYOK model access, one prompt -> one verified answer, operator-facing artifacts, and the core generate-and-verify workflow. | In preparation |
| **Pro** | Professionals and teams that want Undes in regular engineering work. | Licensed team use, workflow integrations, configurable policies, engineering memory, run history, and team-oriented reporting. | Not publicly available |
| **Enterprise** | Organizations with governance, security, and deployment requirements. | Enterprise deployment options, governance, RBAC, audit/retention controls, centralized policy, and support. | Not publicly available |

## Community License Scope

Community is intended for personal learning, individual evaluation, research,
experimentation, prototypes, and limited individual use on your own initiative.

You may use Community individually even while working on a commercial product,
provided Undes is not adopted as part of a team, company, client, CI/CD, or
managed development process.

Regular team/company use, client delivery, CI/CD, production workflow use, and
organization-managed workflows require a separate paid license.

## Versions

- **Community** — public documentation is available in the [`community`](https://github.com/HominoITea/undes/tree/community) branch. The npm package is being prepared for release.
- **Pro** — paid edition for regular professional/team use; not publicly available.
- **Enterprise** — paid edition for governed organization deployment; not publicly available.

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
