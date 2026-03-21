<!-- Generated: 2026-03-12 | Version: v1.0 | Effective date: 2026-03-12 -->

# Commercial Roadmap

## Metadata
- Audience: Founder / Product / Commercial review
- Scope: commercialization only
- Working subproject name: `Rassvet`
- Naming rule: `Rassvet` is the commercialization-track codename only; it is not the locked product name of the hub/OSS core
- Period: `2026-03-12` to `2026-06-30`
- Rule: technical implementation work is tracked separately in `ai/ROADMAP.md`

## 1. Objective
- Publish the OSS core on `2026-03-22`.
- Turn the release into the first commercial proof, not just a visibility event.
- Build on the completed internal pilot baseline rather than on an untested core.
- Keep paid add-ons out of the OSS repository.
- Validate whether `GitLab` becomes the first commercial integration package.
- Keep `OpenClaw` as a long-term strategic option only.

## 2. Commercial Principles
- `OSS core` stays public.
- First monetization is `Paid Pilot, 14 days`.
- `GitLab` is the nearest commercial integration direction.
- The first paid pilot does **not** include `GitLab` delivery in its base scope.
- `Jira` is optional after pilot validation.
- `OpenClaw` is not part of the March offer.
- Paid add-ons are developed outside the OSS repository.

## 3. Phase Roadmap

### Phase A. Launch Preparation
- Period: `2026-03-12` to `2026-03-21`
- Goal: freeze the public package and commercial offer
- Success criteria:
  `LICENSE`, `README`, `CONTRIBUTING.md`, `SECURITY.md`,
  launch post draft, pilot offer text, `OSS vs Paid` note are ready,
  detailed internal commercialization docs are moved out of the public release package,
  and `PUBLIC_RELEASE_CHANGE_MANAGEMENT.md` is technically enforceable on the git host

### Phase B. Public OSS Release
- Period: `2026-03-22`
- Goal: ship the first public release
- Success criteria:
  repository is public-ready, release note is published, outreach starts the same day

### Phase C. Post-Launch Validation
- Period: `2026-03-23` to `2026-03-31`
- Goal: validate market response and first serious sales conversations
- Success criteria:
  `10+` targeted outreach messages,
  `3+` qualified conversations,
  `1+` strong pilot discussion

### Phase D. First Paid Proof
- Period: `2026-04-01` to `2026-04-30`
- Goal: close the first paid pilot
- Success criteria:
  `1` signed paid pilot or a clear repricing/repositioning decision

### Phase E. First Add-on Decision
- Period: `2026-05-01` to `2026-06-30`
- Goal: decide whether to invest in a private `GitLab` package
- Success criteria:
  either approve the first private add-on outside the OSS repo
  or explicitly defer integrations until demand is stronger

## 4. KPI Targets
| KPI | Target Date | Target Value | Owner |
|---|---|---:|---|
| Public OSS release completed | 2026-03-22 | 1 | Founder |
| Qualified commercial conversations | 2026-03-22 | 3 | Founder |
| Outreach messages sent | 2026-03-26 | 10 | Founder |
| Paid pilot signed | 2026-03-26 | 1 | Founder |
| Booked revenue (USD) | 2026-03-26 | 3000 | Founder |
| Commercial scope kept outside OSS repo | ongoing | 100% | Founder |

## 5. Milestones
| Date | Milestone | Expected Output | Status |
|---|---|---|---|
| 2026-03-15 | Offer freeze | one clear paid pilot offer | In Progress |
| 2026-03-18 | Content freeze | launch post + article plan ready | Planned |
| 2026-03-21 | Launch gate | public/legal package complete | Planned |
| 2026-03-22 | OSS release | first public launch | Planned |
| 2026-03-26 | Sales checkpoint | outreach and calls reviewed | Planned |
| 2026-04-30 | Paid proof checkpoint | first pilot closed or offer revised | Planned |
| 2026-06-30 | Add-on decision | GitLab add-on go / no-go | Planned |

## 6. Offer Ladder
| Offer | Scope | Price | Status |
|---|---|---:|---|
| OSS Core | public self-serve core | 0 USD | Active |
| Paid Pilot, 14 days | 1 repo, 1 team, fixed scope | 3000 USD | Primary |
| GitLab Integration Add-on | private post-pilot integration package | 3000 USD | Post-pilot only |
| Jira Add-on | post-pilot workflow package | quote separately | Later |
| OpenClaw Adapter | long-term strategic option | n/a | Deferred |

## 7. Risk Register
| Risk | Mitigation | Owner | Status |
|---|---|---|---|
| Launch slips past `2026-03-22` | cut scope early and freeze public package | Founder | Open |
| OSS message is too vague | keep one positioning line and one primary offer | Founder | Open |
| Pilot scope creep | use fixed-scope SOW and change requests | Founder | Open |
| Paid add-on work leaks into OSS repo | enforce boundary policy and private repos | Founder | Controlled |
| Launch gets attention but no calls | pair content with direct outreach | Founder | Open |

## 8. Decisions Locked
- Commercial planning is tracked in this file, not in `ai/ROADMAP.md`.
- Technical roadmap remains engineering-only.
- Shared architecture enablers may remain in `ai/ROADMAP.md` only if they provide standalone OSS value.
- `GitLab` is the first integration to evaluate commercially.
- `OpenClaw` remains a long-term strategic option.
- Private add-ons must stay out of the OSS repository.
- Private commercial code (paid add-ons, integrations) is hosted on GitLab.

### Distribution & Development Flow (agreed 2026-03-21)

**Three zones:**

| Zone | Platform | Visibility | Content |
|---|---|---|---|
| OSS Core | GitHub | **public** | All code, README, LICENSE, CONTRIBUTING, CI |
| Paid Add-ons | GitLab | **private** | GitLab integration, Jira add-on, future commercial packages |
| Internal Docs | Separate private storage | **private** | Commercialization plans, pricing, KPIs, debate logs, internal change logs |

**Development flow:**
- All code development happens directly in the **public GitHub repo** (single source of truth for code).
- External contributors submit PRs to the public GitHub repo.
- Team members also work directly in the public GitHub repo.
- No private→public sync scripts. No mirrors. No two-repo code duplication.

**What goes public (GitHub):**
- All source code (`ai/scripts/`, `ai/prompts/`, etc.)
- `README.md`, `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`
- `package.json`, config files, CI workflows
- `ai/ROADMAP.md` (technical roadmap, engineering-only)

**What stays private (removed before public launch):**
- `docs/commercialization/` (pricing, strategy, KPIs, pilot terms)
- `UNIFIED_MODEL_CHANGE_LOG.md` (internal agent change log)
- `PROJECT_PLANNED_CHANGES.md` (internal planning)
- Debate logs and internal review records
- Any file containing pricing, revenue targets, or client information

**Launch sequence:**
1. Create private GitHub repo, push current state
2. Move internal docs to separate private storage
3. Scan git history for secrets; squash to clean initial commit if needed
4. Switch GitHub repo to public

## 9. Action Tracker
| Action | Deadline | Status | Expected Impact |
|---|---|---|---|
| Finalize public launch doc set | 2026-03-15 | In Progress | lowers launch risk |
| Freeze paid pilot wording and scope | 2026-03-15 | In Progress | improves conversion clarity |
| Prepare launch content plan | 2026-03-18 | Planned | improves reach |
| Prepare outreach list | 2026-03-19 | Planned | creates pipeline |
| Move detailed commercialization docs to a private planning surface before public launch | 2026-03-21 | Planned | prevents public leakage of internal pricing and paid-feature plans |
| Configure public release change-management controls (public mirror, protected branches, no-manual-push policy, bot sync path) | 2026-03-21 | Planned | prevents accidental public leakage and uncontrolled publication |
| Freeze public export allowlist manifest for first mirror sync | 2026-03-21 | Planned | makes public package reproducible and reviewable |
| Review pilot responses and pricing | 2026-03-26 | Planned | informs April decisions |
| Draft private GitLab add-on scope outside OSS repo | 2026-04-15 | Planned | prepares first expansion option |
