# Legacy Artifacts

This folder keeps historical or runtime-generated root artifacts that were moved out of project root to reduce clutter.

## Current Structure
- `root-runtime/`
  - `README.md`
  - `root-outputs/`
  - `test-snapshots/`
- `docs/`
  - `README.md`
  - `archive/`
    - `README.md`
    - `CODEX_TASKS_20260310.md`
    - `improvments-20260310/`
  - `CODEX_TASKS.md` (superseded redirect only)
  - `improvments/` (redirect only; active docs moved to `ai/design/`)

## Policy
- Do not delete historical files by default.
- Move obsolete or duplicate root artifacts here.
- If an artifact becomes active again, move it back with an explicit change log entry.
- Active design/research files should live in `ai/design/`, not under `legacy/`.
- Treat `root-runtime/` as cold archive, not as a runtime fallback.
- Prefer redirect notes over stale "working" documents in `legacy/docs/`.
