# Root Runtime Archive

This folder is a cold archive of root-level runtime artifacts that were moved
out of project root to reduce clutter.

Current structure:
- `root-outputs/`
  - historical root outputs such as `.code_index.json`,
    `.context_bundle.md`, and `.context_cache.json`
- `test-snapshots/`
  - moved `.tmp-test-work*` snapshots created by earlier test runs

What it is not:
- not the current runtime location
- not a fallback source of truth
- not a place for new active files

Current runtime writes these artifacts under project `.ai/`, not here.

Treat everything in this folder as historical-only unless a future migration
explicitly restores a file back into active use.
