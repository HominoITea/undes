<!-- Generated: 2026-03-13 | Version: v1.0 -->

# Pre-Launch Checklist

Target date: **2026-03-22**

Sources: `oss-core-launch-memo`, `review-technical`, `review-legal`, `review-cfo`, `commercial-roadmap`, `PUBLIC_RELEASE_CHANGE_MANAGEMENT.md`

---

## P0 — Blocks public OSS release

- [ ] **LICENSE file** — Add Apache 2.0 `LICENSE` to repo root
  - Deadline: 2026-03-14
  - Source: legal review #2

- [ ] **README rewrite** — Rewrite under new positioning ("repo-centric orchestration and quality layer")
  - Deadline: 2026-03-16
  - Source: technical review #4, memo #9

- [ ] **CONTRIBUTING.md with DCO** — Inbound contribution policy, AI-code disclosure clause
  - Deadline: 2026-03-15
  - Source: legal review #2

- [ ] **Secrets audit** — Full git history scan for leaked API keys, `.ai.env` references
  - Deadline: 2026-03-15
  - Source: technical review #4

- [ ] **Internal paths cleanup** — Remove or abstract `/home/kair/...` from code, tests, md files
  - Deadline: 2026-03-18
  - Source: technical review #4

- [ ] **Remove `docs/commercialization/` from public package** — Move to private surface or exclude via allowlist export
  - Deadline: 2026-03-21
  - Source: legal review #8, technical review #4, PUBLIC_RELEASE_CHANGE_MANAGEMENT.md

- [ ] **Public mirror repository** — Create separate public repo, configure protected branches, bot-only push
  - Deadline: 2026-03-21
  - Source: PUBLIC_RELEASE_CHANGE_MANAGEMENT.md

- [ ] **`npm run ai:release:check` passes** — Verify release gate validates the current enforced release blockers: required release artifacts (`LICENSE`, `THIRD_PARTY_NOTICES.md`, `config/public-export-manifest.json`) exist and forbidden private-planning paths are absent
  - Deadline: 2026-03-21
  - Source: PUBLIC_RELEASE_CHANGE_MANAGEMENT.md

- [ ] **Dead feature cleanup** — `architecture-check.js` is Rust-only, dead for JS projects. Either remove from public release or land JS profile before launch
  - Deadline: 2026-03-20
  - Source: technical review #4

## P1 — Blocks first paid pilot

- [ ] **IP Assignment founder → TOO** — Sign IP transfer agreement (physical person → TOO), covers all repo code
  - Deadline: before first invoice
  - Source: legal review #2

- [ ] **Pilot SOW template** — Fixed-scope contract: 1 repo, 1 team, 8-10 tasks, 14 days, readout. Include: change request clause ($1,000+), limitation of liability, NDA section, IP allocation for customizations
  - Deadline: 2026-03-17
  - Source: legal review #3, CFO review #2

- [ ] **Bank accounts** — Checking + foreign currency account for TOO
  - Deadline: 2026-03-19
  - Source: legal review action plan #9

- [ ] **PRIVACY / Data Handling Note** — What data is processed (git log, prompts, logs), purposes, third parties (OpenAI/Anthropic API), deletion policy
  - Deadline: 2026-03-16
  - Source: legal review #5

- [ ] **Notify MCRIAP** — Personal data collection notification per Art. 14 of PD Law
  - Deadline: 2026-03-19
  - Source: legal review #5

- [ ] **DPA template** — Data Processing Agreement as pilot contract appendix
  - Deadline: 2026-03-17
  - Source: legal review #6

- [ ] **Demo repo + stable prompts** — Clean small repo, 2-3 prompts that reliably produce good output, fallback pre-recorded run
  - Deadline: 2026-03-18
  - Source: technical review #7

- [ ] **Pricing freeze** — Pilot $3,000; GitLab add-on $3,000 (revised from $1,500); advisory $100-200/hr; do NOT publish advisory rate alongside pilot price
  - Deadline: 2026-03-15
  - Source: CFO review #2, commercial-roadmap #3

- [ ] **Delivery rule** — "Delivery starts after payment received, not after contract signed"
  - Deadline: codify in SOW
  - Source: CFO review #3

## P2 — Important but not blocking

- [ ] **SECURITY.md** — Responsible disclosure policy
  - Deadline: 2026-03-19
  - Source: memo #7

- [ ] **User Agreement / Legal Notice** — In `docs/USER_AGREEMENT.md` and/or `README`. Add jurisdiction-specific review before public release.
  - Deadline: 2026-03-19
  - Source: legal review #1

- [ ] **`.env.example`** — Demo configuration without real keys
  - Deadline: 2026-03-19
  - Source: technical review #4

- [ ] **CHANGELOG.md** — For first release
  - Deadline: 2026-03-21
  - Source: technical review #4

- [ ] **Quick-start guide** — Currently does not exist
  - Deadline: 2026-03-20
  - Source: technical review #3

- [ ] **IP audit: dependencies + licenses** — Verify all npm deps are compatible with Apache 2.0
  - Deadline: 2026-03-17
  - Source: legal review #2

- [ ] **Check OpenAI/Anthropic ToS** — Confirm commercial use of API outputs is allowed
  - Deadline: 2026-03-19
  - Source: legal review #7

- [ ] **Outreach list** — 10-15 target contacts from warm network
  - Deadline: 2026-03-19
  - Source: commercial-roadmap action tracker

- [ ] **Launch content** — Launch post + article plan
  - Deadline: 2026-03-18
  - Source: commercial-roadmap milestone

- [ ] **Withholding tax check** — Cross-border API payments to US (potential 15-20% KPN at source). Check US-KZ tax convention
  - Deadline: 2026-03-19
  - Source: legal review #4

## Post-launch

- [ ] **Case study from first pilot** — For April scaling
- [ ] **Referral mechanism** — Reference call from first client
- [ ] **Part-time helper** — Need delivery capacity at 2+ parallel pilots
- [ ] **Plan B document** — What to do on March 27 if revenue = $0

---

## How to use

Update this file as items are completed. Mark `[x]` and add completion date.

All P0 items must be done before `2026-03-22`.
All P1 items must be done before first paid invoice.

Notes:
- Secrets audit remains a separate checklist item and is not currently covered by `npm run ai:release:check`.
- The canonical commercial roadmap is `commercial-roadmap.md`; this file is the execution checklist, not a second roadmap.
