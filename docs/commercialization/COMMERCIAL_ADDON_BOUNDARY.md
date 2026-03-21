# OSS Core / Commercial Add-on Boundary

Status: active policy
Priority: high

## Summary

This repository is the open-source core.
Paid add-ons must not be developed or stored in the base repository.

Commercial work should use:
- separate private repositories
- separate private packages
- separate hosted services

This repo may contain only:
- generic OSS-safe extension points
- public documentation
- public configuration and tests
- interfaces that remain useful without proprietary code

## Immediate Commercial Direction

- `GitLab` is the nearest commercial integration target.
- `Jira` is a post-pilot optional add-on.
- `OpenClaw` is a long-term strategic option, not a March 2026 deliverable.

## Rules

1. Do not commit proprietary adapter code to this repository.
2. Do not commit customer-specific workflow logic to this repository.
3. Do not commit hosted control-plane code for paid offerings to this repository.
4. Do not commit paid-only feature flags or package references unless the OSS core still gains a generic public interface.
5. If a change is valuable only when paired with private code, it belongs outside this repo.

## Allowed In OSS Core

- public plugin or adapter interfaces
- generic webhook contracts
- generic MR/PR event abstractions
- generic docs about supported integration surfaces
- tests for public extension points

## Shared Architecture Enablers

The OSS core may include generic architecture work that enables both free and paid layers **only if** it has standalone value without proprietary code.

Examples allowed in OSS core:
- plugin / hook architecture in `hub.js` or `generate-context.js`
- generic adapter interfaces
- generic auth/session abstractions that are useful locally without enterprise code
- public runtime contracts for external integrations
- test harnesses for public extension points

Examples not allowed in OSS core:
- implementation details that only exist to support one private GitLab/Jira package
- hardcoded private package loading
- customer- or vendor-specific business workflow logic

If a feature needs private code to become useful, it belongs outside OSS core.

## Not Allowed In OSS Core

- private GitLab enterprise adapter implementation
- Jira commercial workflow package
- OpenClaw commercial bridge or managed runtime adapter
- customer-specific deployment scripts
- private support tooling or billing logic

## Local Development Safety

- Use a gitignored local scratch path such as `commercial-addons-local/`
  only for temporary experiments.
- Long-lived paid add-on work must be moved to a separate private repository.

## Planning Visibility

- While this repository is still private, internal commercialization docs may temporarily live under `docs/commercialization/`.
- Before the OSS release becomes public, detailed paid-feature plans, pricing notes, sales assumptions, and internal launch materials must be moved to a private planning surface.
- The public repository may keep only a public-safe boundary note such as:
  `OSS core is public; enterprise integrations and managed features are commercial and developed outside this repository.`
- Public release promotion and mirror sync must follow:
  `docs/commercialization/PUBLIC_RELEASE_CHANGE_MANAGEMENT.md`
- Before any public release or release-branch promotion, run:
  `npm run ai:release:check`

## Pre-Merge Questions

- Does this change have standalone value in the OSS core?
- Does it leak proprietary commercial value?
- Does it hardcode private package names, customers, endpoints, or hosted assumptions?
- Would publishing this reduce the separation between free core and paid layer?

If any answer is `yes` to the commercial leakage questions,
do not merge the change into this repository.
