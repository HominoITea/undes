# Design Docs

Active design and research documents live here.

Purpose:
- keep working design artifacts outside `legacy/`;
- keep detailed design/research notes separate from `ai/ROADMAP.md`;
- provide one stable place for reusable design patterns and article reviews.

Current active files:
- `ai/design/DISCUSSION_PATTERN.md` — reusable multi-model discussion workflow
- `ai/design/features/README.md` — active future feature design docs
- `ai/design/article-reviews/links.txt` — current queue/state for article review batches
- `ai/design/article-reviews/resume_*.txt` — completed review outputs by model

Policy:
- If a design note is still active, keep it under `ai/design/`.
- If a future feature needs real design discussion, store it under `ai/design/features/`.
- If a document becomes historical-only, move it to `legacy/docs/archive/`.
- Keep roadmap items in `ai/ROADMAP.md`, but link to detailed design docs here when the roadmap summary is too small.

Historical snapshots:
- `ai/design/archive/ROADMAP_DETAILED_20260310.md` — detailed roadmap before it was reduced to a short priority map

Historical note:
- Early `legacy/docs/improvments/` working materials were split on 2026-03-10:
  - active docs moved here;
  - historical drafts archived under `legacy/docs/archive/improvments-20260310/`.
