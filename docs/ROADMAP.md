# Eidolon Engineering Roadmap

Last refreshed: May 3, 2026

This file is a short pointer. The engineering planning that used to live here now lives in two documents that are kept current:

- [`2026-04-18-alpha-1-0-roadmap-and-status.md`](plans/2026-04-18-alpha-1-0-roadmap-and-status.md) — release-line tracker from `0.35.0` through `Alpha 1.0`
- [`2026-05-03-v1-0-implementation-plan.md`](plans/2026-05-03-v1-0-implementation-plan.md) — audit-grounded slice-level implementation plan with files, dependencies, and definition-of-done gates

Per-patch detail lives in `index.html` Patch Notes.

## Why this file is short now

Earlier versions of this doc duplicated content with the top-level `ROADMAP.md` and with the active plan docs under `docs/plans/`. The duplication drifted: each refresh updated some files and missed others. The single-source-of-truth structure is now:

- `ROADMAP.md` (repo root): one-paragraph product roadmap pointer
- `docs/ROADMAP.md` (this file): one-paragraph engineering roadmap pointer
- `docs/plans/2026-04-18-alpha-1-0-roadmap-and-status.md`: the active release tracker
- `docs/plans/2026-05-03-v1-0-implementation-plan.md`: the canonical implementation plan
- `index.html` Patch Notes: per-patch history

When this file and the plan docs above disagree, the plan docs win.

## Architecture and review snapshots

For the architecture snapshot of `master` see [`ARCHITECTURE.md`](ARCHITECTURE.md). For the review of what is working and what is fragile see [`REVIEW.md`](REVIEW.md). Those two docs cover the engineering context that used to live here.
