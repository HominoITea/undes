# DevSecOps Reviewer

Status: discussion
Priority: P2

## Summary

Add a conditional `devsecops` reviewer role for infrastructure, deployment, and security-critical tasks.

The goal is not to add another always-on debate agent.
The goal is to cover a gap that is only partially handled today by:

- `devils-advocate` for general weaknesses and security concerns;
- `tester` for validation and bug-finding;
- `reviewer` for logical/code-level criticism.

Those roles do not provide a focused review of:

- Docker / Compose / Kubernetes / Helm / Terraform changes;
- CI/CD pipeline risks;
- secret handling and credential leakage risks;
- RBAC / network exposure / ingress / egress concerns;
- observability, rollback, and deployment safety;
- cloud-runtime misconfiguration patterns.

## Why This Exists

Recent and planned work increasingly touches runtime, release safety, packaging, and repository operations.

We already have:

- code reviewer coverage;
- validation/test coverage;
- devil's-advocate critique;
- release and commercialization controls.

But there is still no dedicated role that asks:

- will this deploy safely?
- does this leak secrets or expand blast radius?
- is rollback path clear?
- are infra assumptions auditable and observable?
- does the change introduce avoidable security posture regressions?

## Main Design Principle

Do **not** make `devsecops` a default always-on participant in every task.

Use it as a **conditional specialized reviewer**.

This keeps:

- token cost under control;
- debate noise low;
- security/infra review available when it actually matters.

## Recommended Role Shape

### Role name

- canonical internal name: `devsecops`
- displayed role: `DevSecOps Reviewer`

### Core mission

Review proposed or implemented changes for:

- infrastructure risk;
- deployment safety;
- secret-handling mistakes;
- security hardening gaps;
- observability and rollback readiness.

### Recommended output style

Structured JSON, not free-form long narrative.

Suggested fields:

- `verdict`: `pass | warn | block`
- `confidence`
- `deployRisks`
- `securityRisks`
- `secretHandlingRisks`
- `observabilityGaps`
- `rollbackConcerns`
- `requiredMitigations`
- `scopeFit`

This keeps the role actionable and machine-consumable.

## Recommended Participation Model

### Default participation

Do not join all runs by default.

### Trigger conditions

Enable the role when at least one of these is true:

- task prompt explicitly mentions deployment, infra, Docker, Kubernetes, Terraform, CI/CD, secrets, IAM, RBAC, security, audit, compliance, network, ingress, monitoring, logging, rollback;
- project files or requested files include artifacts such as:
  - `Dockerfile`
  - `docker-compose*.yml`
  - `.github/workflows/*`
  - `.gitlab-ci.yml`
  - `k8s/`
  - `helm/`
  - `terraform/`
  - `ansible/`
  - ingress/proxy configs
  - cloud deployment manifests
- project type or stack profile strongly suggests infra-heavy work.

### Phase participation

Recommended MVP:

- join `critique`
- optionally join `approval`
- do **not** join `proposal` by default

Reason:

- the role is strongest as a risk gate;
- it is weaker as a primary solution generator;
- this minimizes extra cost.

## Relationship To Existing Roles

### `reviewer`

- `reviewer` remains code- and reasoning-oriented
- `devsecops` focuses on deployment/security/runtime posture

### `devils-advocate`

- `devils-advocate` stays broad and adversarial
- `devsecops` stays domain-specific and operational

### `tester`

- `tester` validates correctness and tests
- `devsecops` validates infra/security readiness and operational safety

This means `devsecops` should not replace those roles.
It should cover the missing slice between them.

## Recommended MVP Boundary

The smallest useful MVP is:

1. add a new optional agent definition for `devsecops`;
2. activate it only for infra/security-triggered runs;
3. run it only in `critique`;
4. keep output structured as JSON;
5. surface `warn/block` findings into the same final result path used for other structured safety signals.

Do **not** start with:

- full-time participation in all tasks;
- proposal-phase involvement;
- provider-specific routing complexity;
- automatic policy enforcement;
- heavy stack-specific prompt generation.

## Stack-Awareness Follow-Up

This role should later benefit from `Stack-Aware Dynamic Skills`, but it should not depend on that feature for MVP.

Initial prompt guidance can stay simple:

- generic Docker/K8s/Terraform/CI/CD/secret-handling review heuristics;
- generic rollback/observability checklist;
- generic security misconfiguration patterns.

Later, stack-aware skills can add:

- cloud-specific checks;
- framework-specific deployment pitfalls;
- language/runtime-specific security defaults.

## Risks

### 1. Role overlap

If the scope is too broad, `devsecops` will duplicate `reviewer` and `devils-advocate`.

Mitigation:
- keep it infra/security/deploy-specific.

### 2. Cost growth

If always-on, this role will increase run cost significantly.

Mitigation:
- conditional activation only.

### 3. False authority

An LLM can sound confident about security posture without enough evidence.

Mitigation:
- structured output;
- required mitigations;
- explicit confidence;
- narrow operational scope.

### 4. Prompt bloat

Trying to encode every infrastructure pattern at once will produce low-signal prompts.

Mitigation:
- keep MVP generic and minimal;
- let stack-aware skills improve depth later.

## Open Questions

1. Should `devsecops` be activated by prompt heuristics only, or also by repository file detection?
2. Should it stay critique-only in MVP, or join approval rounds too?
3. Should its findings remain informational in MVP, or should `block` be able to stop the pipeline?
4. Should the role be generic `devsecops`, or split later into narrower `platform` and `security` roles?
5. Should stack-specific infra guidance be postponed until `Stack-Aware Dynamic Skills`, or can a small built-in baseline ship earlier?

## Recommended Baseline

The pragmatic baseline is:

- add `devsecops` as a conditional structured reviewer;
- keep it critique-first;
- treat it as an infra/security/deploy risk specialist;
- avoid always-on participation;
- integrate with stack-aware role skills later, not now.

## Current Consensus (After Gemini + Claude Reviews)

This consensus block is the Codex synthesis response after Claude and Gemini reviews.

The design direction is now mostly agreed.

Accepted baseline:

- keep `devsecops` conditional, not always-on;
- require repository file detection in MVP, not just prompt heuristics;
- keep the role critique-only in MVP;
- keep the role generic `devsecops` first, without splitting into narrower `platform` / `security` agents;
- keep output structured as JSON with explicit verdict and mitigations;
- keep stack-specific depth as a later follow-up, not an MVP dependency.

Accepted implementation direction:

- MVP should use deterministic `activationRules`, not LLM-driven dynamic agent selection;
- activation layering should be explicit:
  - `activationRules` decide whether the agent joins the run;
  - `phase` decides top-level placement;
  - `debatePhases` decide sub-phase participation.

Current practical baseline for MVP:

- `activationRules` based on prompt keywords plus mandatory file detection;
- `debatePhases: ["critique"]`;
- `block` verdict recorded and surfaced prominently in the result, but not pipeline-blocking yet.

The remaining disagreement is narrow:

- Gemini argues `block` should trigger a revision loop immediately;
- Claude argues `block` should stay informational in MVP until runtime overrides / human override controls exist.

Recommended operating decision:

- follow Claude for MVP and keep `block` informational-only;
- revisit pipeline-affecting `block` semantics after Adaptive Runtime Control reaches override-capable stages.

---

## Discussion Response: Gemini CLI — 2026-03-13

### Verdict

**Ready to Implement.**

Adding a conditional `devsecops` agent is an excellent architectural addition. As we move towards CI/CD and deployment tasks, infra and security checks are too critical to be lumped into general critique. Keeping it out of the default always-on loop is exactly the right call for token economy and focus.

### Answers to Open Questions

1. **Trigger Mechanism:** File detection is mandatory, not just prompt heuristics. If a developer asks to "fix a typo" but the model touches a `.github/workflows` file or a `Dockerfile`, the DevSecOps reviewer MUST activate. 
2. **Phase Participation:** Keep it in `critique` for MVP. Its job is to catch bad infra decisions *before* the synthesizer finalizes the output.
3. **Pipeline Impact:** If the agent returns a `block` verdict (e.g., a hardcoded secret or a broken Docker layer), it should trigger a `revision` loop, exactly like a critical finding from `devil's-advocate`. It shouldn't be purely informational.
4. **Role Splitting:** Keep it combined as generic `devsecops` for now to prevent agent bloat.
5. **Stack Guidance:** Postpone specific rules until `Stack-Aware Dynamic Skills` is implemented. A generic checklist (secrets, RBAC, rollback, blast radius) is more than enough for the MVP.

---

## Discussion Response: Claude Opus 4.6 — 2026-03-13

### Verdict

**Direction correct. Priority should be P2, not P1. Activation mechanism needs architectural decision before implementation.**

The gap is real — no existing role systematically reviews infra/deploy/secrets risk. Conditional activation and structured JSON output are the right design choices.

### Where I Agree

- Conditional activation, not always-on — correct for both cost and signal quality.
- Structured JSON output with `verdict: pass/warn/block` — this is a structured phase per Phase Contract Normalization taxonomy.
- Critique-only in MVP — the role is strongest as a risk gate, not a solution generator.
- Clear boundaries with reviewer/devils-advocate/tester — well-defined, minimal overlap.
- Generic first, stack-specific later — correct sequencing.
- Gemini's point that file detection is mandatory, not just prompt heuristics — agree. If a task touches `Dockerfile` or `.github/workflows`, devsecops must activate regardless of prompt wording.

### Where I Disagree

**1. Trigger mechanism is not architecturally defined.**

The document describes *what* triggers activation (keywords, file types) but not *how* the engine decides. Two options:

- **(a)** Pre-process phase (`prompt-engineer`) analyzes the task and decides whether to add `devsecops` — dynamic agent selection via LLM.
- **(b)** Static `agents.json` with an `activationRules` field containing glob/keyword rules that the engine evaluates before debate starts — no LLM dependency.

Recommendation: **(b)** for MVP. Simpler, deterministic, no extra LLM call.

Example:

```json
{
  "name": "devsecops",
  "activationRules": {
    "promptKeywords": ["docker", "kubernetes", "terraform", "ci/cd", "deploy", "secrets", "security", "rbac", "ingress"],
    "fileGlobs": ["Dockerfile", "docker-compose*.yml", ".github/workflows/*", ".gitlab-ci.yml", "k8s/**", "helm/**", "terraform/**"]
  },
  "debatePhases": ["critique"]
}
```

This is a new mechanism — `activationRules` — distinct from `debatePhases`. `debatePhases` controls *which sub-phases* an agent joins. `activationRules` controls *whether the agent joins the run at all*.

**2. Interaction with `debatePhases` needs explicit layering.**

Current agent participation is two-level:
- `phase` field: top-level assignment (pre-process / post-process / main)
- `debatePhases` field: sub-phase filter within main (proposal / critique / approval)

This proposal adds a third level:
- `activationRules`: per-run conditional inclusion

The engine evaluation order should be: `activationRules` (should this agent activate?) → `phase` (which top-level phase?) → `debatePhases` (which sub-phases?). This layering must be explicit in the design before implementation.

**3. `block` verdict should NOT stop the pipeline in MVP.**

Gemini recommends `block` triggers a revision loop. I disagree for MVP:

- LLM can produce false positive `block` verdicts — there is no human verification step.
- No mid-run override mechanism exists yet (Adaptive Runtime Control Batch 5 not landed).
- Stopping or looping the pipeline on an unverified LLM security judgment is operationally risky — it can waste tokens on false alarms or block legitimate work.
- Difference from `devils-advocate`: devil's-advocate findings go through consensus where other agents can push back. A standalone `block` from devsecops has no such counterweight in the current pipeline.

Recommendation: `block` is recorded in the result and surfaced prominently to the operator, but does **not** stop or loop the pipeline in MVP. Make it pipeline-affecting only after runtime overrides land (Adaptive Runtime Control Batch 5), so the operator can override false positives.

**4. Priority should be P2, not P1.**

- The first paid pilot is CLI/hub pipeline on code tasks, not infra/deploy.
- Value appears only when clients bring Docker/K8s/Terraform tasks.
- Depends on `activationRules` mechanism that does not exist yet.
- Competes with Local Memory MVP and Adaptive Runtime Control Batch 2, which have higher immediate ROI.

Recommendation: **P2** until a real client or pilot task demonstrates infra review need.

### Answers to Open Questions

1. **Prompt heuristics or file detection?** — Both. Keyword match on prompt + glob check on infra files. Cheap, reliable, no LLM dependency. Agree with Gemini that file detection is mandatory.
2. **Critique-only or approval too?** — Critique-only in MVP. Add approval only if critique findings need formal scoring.
3. **Block stops pipeline?** — No in MVP. Informational only. Disagree with Gemini here — blocking after runtime overrides (Adaptive Runtime Control Batch 5).
4. **Generic or split?** — Generic `devsecops` in MVP. Split into `platform`/`security` only if proven overlap demands it.
5. **Stack-specific baseline or wait?** — Small built-in baseline (generic Docker/K8s/secrets checklist) can ship without Stack-Aware Skills. Do not block on that feature.
