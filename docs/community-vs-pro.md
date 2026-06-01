# Community vs Pro

Undes has separate edition packages so the public Community workflow and the
paid Pro workflow can stay clear.

This page describes the current public boundary. It is not a promise of future
Team or Enterprise functionality.

## Quick Comparison

| Area | Community | Pro |
|---|---|---|
| npm package | `@undes.ai/cli` | `@undes.ai/cli-pro` |
| binary | `undes` | `undes-pro` |
| primary use | individual evaluation, learning, research, prototypes, limited individual initiative use | paid professional local workflow |
| license | Community license scope | Pro license required |
| model keys | BYOK | BYOK |
| core workflow | generated-and-verified answer | generated-and-verified answer with Pro UI/history surfaces |
| terminal UI | no Pro TUI | Pro terminal UI on TTY |
| history | `inspect latest` only | local run history command |
| native verifier | optional where included by the package | required for license-gated Pro commands |
| team/organization use | not licensed | contact us; no public Team/Enterprise package is committed |

## Community

Community is the focused local workflow:

```bash
npm install -g @undes.ai/cli
undes init
undes run --prompt="Review this focused change."
undes inspect latest
undes doctor
```

Community is local-first and BYOK. Model calls go to the model providers you
configure. It exposes a safe progress view with `--progress`; full internal
verbose output is not part of the Community package.

Community is free for personal learning, individual evaluation, research,
experimentation, prototypes, and limited individual use on your own initiative.
Managed team/company/client/CI/CD use requires a separate paid license.

## Pro

Pro is the paid local CLI:

```bash
npm install -g @undes.ai/cli-pro@pro-beta
undes-pro license activate <purchase-key>
undes-pro run --prompt="Review this focused change."
undes-pro history
```

Pro adds the paid local surfaces that are implemented in the Pro package:

- license-gated execution;
- required native verification package for Pro commands;
- terminal UI for interactive local runs;
- local run history;
- the same generated-and-verified answer discipline as Community.

Pro does not turn raw prompts, raw model responses, or internal pipeline
artifacts into public command output. The public surface stays outcome-level:
answer, evidence, risks, open checks, and trust status.

## Team And Enterprise

Team and Enterprise usage is handled through direct discussion for now.

There is no public Team package, Team binary, Enterprise install path, hosted
workflow promise, SSO/RBAC promise, CI gate promise, or self-hosted deployment
promise in the current public docs. Those surfaces require a separate product
and architecture decision before they become public commitments.

## Which One Should I Use?

Use Community if you want to evaluate the verification workflow on focused
local tasks.

Use Pro if you have a Pro license and want the paid local CLI surfaces:
license-gated execution, terminal UI, and local history.
