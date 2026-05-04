# Archived planning docs

This folder holds historical planning documents that have been superseded but are kept for reference.

## What lives here and why

These docs were the right shape when they were written, but they no longer reflect either current state or current priorities. They are kept here, not deleted, because the per-slice reasoning they contain is occasionally useful when revisiting why a system was built a particular way.

The active planning lives in:

- [`../2026-04-18-alpha-1-0-roadmap-and-status.md`](../2026-04-18-alpha-1-0-roadmap-and-status.md) — release-line tracker
- [`../2026-05-03-v1-0-implementation-plan.md`](../2026-05-03-v1-0-implementation-plan.md) — audit-grounded implementation plan
- `../../../ROADMAP.md` and `../../ROADMAP.md` — short pointers to the two docs above
- `../../ARCHITECTURE.md`, `../../REVIEW.md` — current architecture and review snapshots
- `../../../index.html` Patch Notes — per-patch history

Per-patch history is the canonical record of what shipped. These archived plan docs are the canonical record of why each band was scoped the way it was.

## Archived contents

### Closed release plans
- `0.21-release-checklist.md` — `0.21` ship checklist
- `2026-04-05-version-0.21-closeout-plan.md` — `0.21` closeout
- `2026-04-05-version-roadmap-0.21-to-0.25.md` — `0.21` through `0.25` band roadmap
- `2026-04-18-0-22-first-hour-closeout.md` — `0.22` first-hour onboarding closeout
- `2026-04-19-0-25-retention-closeout-qa.md` — `0.25` retention closeout QA
- `2026-04-30-0-33-2-repro-sandbox-smoke.md` — `0.33.2` repro sandbox smoke plan

### Topic-specific plans (all shipped)
- `2026-03-31-combat-intent-target-clarity-plan.md`
- `2026-03-31-dungeon-reward-feedback-plan.md`
- `2026-03-31-gameplay-and-dungeon-plan.md`
- `2026-03-31-loot-feedback-autoloot-plan.md`
- `2026-04-01-client-asset-persistence-plan.md`
- `2026-04-01-dungeon-entrance-context-hints-plan.md`
- `2026-04-02-scalable-dungeon-progression-and-endgame-plan.md`
- `2026-04-04-eidolon-current-state-and-next-steps-plan.md`

### Replaced by the v1.0 plan
- `2026-04-improvement-plan.md` — was `IMPROVEMENT_PLAN.md` at repo root; replaced by the v1.0 implementation plan
- `2026-04-implementation-checklist.md` — was `docs/IMPLEMENTATION_CHECKLIST.md`; the four-phase plan it tracked is fully shipped, and forward implementation now lives in the v1.0 plan

## Rule for adding to this folder

When a release line closes, the active roadmap-and-status doc collapses its detail into the shipped-line summary. The detailed plan that drove that line, if any, moves here at the same time. Do not modify archived docs after they land here; if their reasoning needs a successor, write a new dated doc in `docs/plans/`.
