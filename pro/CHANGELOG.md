# Pro Changelog

## v0.1.9 — 2026-06-05

Undes Pro v0.1.9 is the current Pro npm package release.

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
