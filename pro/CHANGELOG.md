# Pro Changelog

## v0.1.11 — 2026-06-11

Undes Pro v0.1.11 is the current Pro npm package release.

### What Changed

- Fixed published `undes-pro run` startup and bundled edition-manifest lookup.
- Stabilized first-run setup so a newly initialized project does not immediately
  report scaffold drift on the first run.
- Fixed structural search package lookup in installed npm packages.
- Added the Pro session shell, where each turn is still a normal evidence-backed
  run and prior context is attached through the explicit `--attach` path.
- Added Engineering Memory v1 as project-scoped JSONL with pure-JS token search.
- Added model qualification tooling and clearer provider trust posture in doctor.
- Kept the public output outcome-level: answer, evidence, risks, open checks and
  trust verdict.

### Install

```bash
npm install -g @undes.ai/cli-pro@latest
undes-pro --version
```

Expected version:

```text
0.1.11
```

Pro requires a valid license. Buy or manage Pro access from
[undes.app/pricing](https://undes.app/pricing).

## v0.1.9 — 2026-06-05

Undes Pro v0.1.9 is superseded by v0.1.11.

### What Changed

- License-gated Pro execution through `@undes.ai/cli-pro` and the platform
  native verification package installed by npm.
- Pro license commands:
  `license activate`, `license status`, `license refresh`, and
  `license deactivate`.
- Terminal UI is the default on interactive TTY runs, with headless mode
  available for CI, redirected output, and explicit `--no-tui` / `--headless`.
- Local run history through `undes-pro history`.
- OpenAI-compatible provider routing for Pro, including OpenRouter, NVIDIA NIM,
  Ollama, LM Studio, llama.cpp, and generic OpenAI-compatible endpoints.
- Single-model mode with `--model` and optional `--provider`.
- Provider data-flow disclosure in `doctor` and `UNDES_NO_NETWORK=1` privacy
  guard for local-only runs.
- Native verifier/package identity checks fail closed when the platform core is
  missing or mismatched.

### Install

```bash
npm install -g @undes.ai/cli-pro@latest
undes-pro --version
```

Expected version:

```text
0.1.9
```

Pro requires a valid license. Buy or manage Pro access from
[undes.app/pricing](https://undes.app/pricing).
