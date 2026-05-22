# Changelog

## v0.1.2 — 2026-05-22

Community v0.1.2 is the current recommended npm release.

### What Changed Since v0.1.0

- More reliable generated-and-verified answers: important generated material is
  preserved more consistently through the final verification result.
- Better output for feature implementation tasks: supported evidence,
  assumptions, open checks, and generated implementation content are separated
  more clearly.
- Safer terminal output: `undes run` stays focused on the answer; use
  `--progress` for high-level progress without internal pipeline details.
- Cleaner npm package boundary: Community excludes internal debug/dev surfaces
  and reports the same version as the published npm package.
- Privacy-preserving update notice: Undes checks only the public npm registry
  for package versions and sends no project content.
- Easier inspection after a run with `undes inspect latest`.

### Upgrade

```bash
npm install -g @undes.ai/cli@latest
undes --version
```

Expected version:

```text
0.1.2
```

### Notes

- `0.1.0` and `0.1.1` are deprecated on npm.
- `--verbose` is recognised for compatibility, but Community now downgrades it
  to the safe `--progress` view.

## v0.1.1 — 2026-05-22

Superseded by v0.1.2.

- Added a privacy-preserving npm update notice.
- Improved Community package build and version consistency.
- Improved package boundary checks.

## v0.1.0 — 2026-05-22

Initial Community npm release.

- Local-first BYOK CLI.
- `undes init`, `undes run`, `undes inspect latest`, and `undes doctor`.
- Generated-and-verified engineering artifacts for focused tasks.
