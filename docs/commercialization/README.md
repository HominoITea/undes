<!-- Generated: 2026-03-12 | Version: v1.0 | Effective date: 2026-03-12 -->

# Commercialization Docs

Naming note:
- `Рассвет` / `Rassvet` is the working name of the commercialization subproject only.
- It is not the canonical product name of the hub/OSS core.
- The hub/core may receive a separate product name later.

This folder stores internal documents related to:
- open-source packaging
- commercialization strategy
- launch planning
- licensing and governance boundaries
- pricing and pilot offers

Current documents:
- `PUBLIC_RELEASE_CHANGE_MANAGEMENT.md`:
  mandatory release-control policy for private canonical repo, public mirror, allowlist export, and no-manual-push publication
- `config/public-export-manifest.json`:
  machine-readable allowlist for the future public export tree used by mirror-sync automation
- `commercial-roadmap.md`:
  separate commercial roadmap with milestones, KPI targets, risks, and action tracker
- `ROADMAP.md`:
  legacy redirect only; kept temporarily so old references resolve to `commercial-roadmap.md`
- `oss-core-launch-memo-2026-03-22.md`:
  internal memo for the first public OSS release planned for `2026-03-22`
- `review-cfo-2026-03-12.md`:
  CFO review -- unit economics, pricing, cash flow, scenarios, risks
- `review-legal-2026-03-12.md`:
  Legal review -- Apache 2.0, IP, contract structure, taxes, personal data (Kazakhstan law)
- `review-technical-2026-03-12.md`:
  Technical architect review -- readiness gap, API costs, what works vs promised, OSS prep
- `LAUNCH_CHECKLIST.md`:
  pre-launch checklist with all P0/P1/P2 items from reviews, deadlines, and sources

Document policy:
- Files here are internal working documents unless explicitly marked public.
- Public-facing launch materials should live in their canonical public paths
  such as `README.md`, `LICENSE`, `CONTRIBUTING.md`, and related docs.
- `ai/ROADMAP.md` should stay technical and not absorb commercialization planning.
- Before the repository is made public, detailed commercialization planning in this folder
  must be moved to a private planning surface or excluded from the public release package.
- Public release promotion must follow `PUBLIC_RELEASE_CHANGE_MANAGEMENT.md`.
- Public export allowlist must stay aligned with `config/public-export-manifest.json`.
- Use `npm run ai:release:check` as the release-blocking guard before any public OSS publication.
- `commercial-roadmap.md` is the only canonical roadmap in this folder; `ROADMAP.md` is a redirect surface.
