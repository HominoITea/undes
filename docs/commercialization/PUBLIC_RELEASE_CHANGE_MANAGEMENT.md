# Public Release Change Management

Status: active policy
Priority: P0 before any public OSS release

## Purpose

This document defines the mandatory change-management process for any future public OSS release.

Naming note:
- `Rassvet` refers only to the commercialization subproject and release-management workstream.
- It must not be treated as the final OSS-core or hub product name unless a separate naming decision is made later.

Goals:
- keep the current repository as the private canonical source while commercialization planning still exists
- prevent accidental leakage of internal pricing, paid-feature plans, and private operational notes
- prevent manual direct pushes to the future public repository
- make public publication reproducible, reviewable, and enforceable

## Canonical Model

The release model is:

1. `Private canonical repository`
   This repository remains the primary engineering source of truth.
2. `Public mirror repository`
   A separate public repository is used for OSS publication.
3. `Allowlist export`
   Public content is exported from the private canonical repository into a clean public tree.
4. `Bot-mediated promotion`
   Exported changes are pushed by automation and merged through PR review.

Direct human push to the public repository is not allowed.

## Mandatory Rules

1. The current private repository must not be made public directly.
2. Public OSS release must use a separate public mirror repository.
3. Detailed commercialization planning must be removed from the exported public tree.
4. Public export must use an allowlist, not a blocklist.
5. Human users must not push directly to public `main`, `master`, `release`, or mirror-sync branches.
6. Public mirror updates must be created only by automation or a dedicated bot account.
7. Public release must be gated by `npm run ai:release:check`.
8. Public publication must happen through PR review, not through ad-hoc local push.

## Required Repository Controls

Once git hosting is configured, the following controls are mandatory:

- protected default branch in the private canonical repository
- protected default branch in the public mirror repository
- direct push disabled for all human users on protected branches
- merge by PR only
- status checks required before merge
- bot-only permission for mirror sync branch updates
- tag/release creation limited to maintainers

Recommended branch model:

- private canonical repo:
  - `main` protected
  - work happens in feature branches
  - merge to `main` only by PR
- public mirror repo:
  - `main` protected
  - export automation pushes to `public-sync` or opens a PR branch
  - merge to public `main` only by reviewed PR

## Public Export Flow

The public release flow must follow this order:

1. Prepare a clean export tree from the private canonical repository.
2. Include only public-safe files from an explicit allowlist.
   The current source of truth for that allowlist is:
   `config/public-export-manifest.json`
3. Run `npm run ai:release:check`.
4. Run any additional public-package validation checks.
5. Push the export result to the public mirror through automation.
6. Open or update a PR in the public mirror repository.
7. Review and merge the PR.
8. Publish tags or npm packages only from the public-clean source.

## Allowlist Principle

Public export must be based on explicit inclusion.

Current allowlist manifest:
- `config/public-export-manifest.json`

Current release gate scope:
- required release artifacts such as `LICENSE`, `THIRD_PARTY_NOTICES.md`, and `config/public-export-manifest.json`
- forbidden private-planning paths such as `docs/commercialization/` and `commercial-addons-local/`
- additional checks such as secrets/history scanning may remain separate release tasks

Typical public-safe content:
- `README.md`
- `LICENSE`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `package.json`
- `ai/`
- `examples/`
- OSS-safe tests and scripts

Private-by-default content:
- `docs/commercialization/`
- `commercial-addons-local/`
- pricing notes
- paid-feature sequencing
- internal sales assumptions
- customer-specific notes
- local absolute paths

## Human Push Policy

The target operating model is:

- humans may work in local branches
- humans may open PRs
- humans may review and merge according to repository permissions
- humans must not push directly to protected public branches
- humans must not publish public releases from an unexported private tree

If the git host cannot yet enforce this technically, the release is not ready.

## Current Pre-Host Rule

Git hosting is not configured yet.

Until it exists:
- this document is the active policy contract
- `npm run ai:release:check` is the current technical guard
- public release remains blocked until repository-side protections can be configured

This means:
- no manual “make repo public” step
- no direct publication from the current repository
- no exception for one-off manual push

## Release Blockers

Public release is blocked if any of the following is true:

- `docs/commercialization/` still exists in the release package
- `commercial-addons-local/` still exists in the release package
- public export uses blocklist-only filtering
- public mirror repository is not separate from the private canonical repository
- protected branches are not configured
- direct human push to the public default branch is still possible
- `npm run ai:release:check` fails

## Minimum Acceptance Criteria

Before the first public OSS release:

1. private canonical repository remains private
2. public mirror repository exists
3. commercialization docs are moved out of the public package
4. export process is documented and reproducible
5. public branch protections are enabled
6. no-manual-push policy is enforceable at the git-host level
7. release checks pass

## Relation To Other Documents

- `COMMERCIAL_ADDON_BOUNDARY.md` defines what may or may not live in OSS core
- `commercial-roadmap.md` defines launch/commercial sequencing
- this document defines how public release promotion must be controlled
- `config/public-export-manifest.json` defines the current public export allowlist
