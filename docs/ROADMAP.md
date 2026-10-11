# Eidolon Engineering Roadmap

Last refreshed: October 11, 2026

This is a short pointer to the [remaining-work register](plans/2026-10-09-release-readiness-remaining.md).
Last accepted public release is Alpha1.79.33, exact
`9ce67fe3d2d0aeae55102d14b579107733d1a719`, CI38142813857attempt2;
all ten ordered jobs and fresh post-terminal identity/readyDB/17asset checks pass.
[Acceptance](plans/2026-10-11-public33-terminal-qualification.json).
Corrective Alpha1.79.34/3ec8bb15/CI38149199718attempt2 has successful
predeploy/validation and both deploy jobs; live QA is active, so its own terminal
and fresh23asset acceptance remain pending. Attempt1's diagnosed network failure
is retained. [Diagnosis/retry](plans/2026-10-11-release34-predeploy-network-retry.json).
Qualified guild/venue/build-menu/direct-trade work is merged into local master
for a coherent successor.579of644local branches are merged;65unmerged histories
remain under individual review. The complete world/art/gameplay/device/
performance/operations/F1–F5/beta/launch scope and historical failures remain
open; these scoped fixes do not establish freeze or beta readiness.

Current forward planning and historical closeout live in these documents:

- [Alpha 1.11–1.99 release roadmap](plans/2026-09-28-alpha1-11-to1-99-release-roadmap.md) — authoritative forward scope: all 89 minor milestones, beta/launch gates and sequential implement/deploy/verify execution. Its opening checkpoint identifies the accepted live release and next candidate.

- [World population and atlas](plans/2026-09-28-world-population-and-atlas.md) — required world density, meaningful locations/activities, accurate map/minimap, delivery assignments and early alpha quality gates. First pass before closed beta, followed by regional refinement.

- [Alpha 1.10 playtest release record](plans/2026-09-23-release1-10-playtest.md) — historical 1.10.2 baseline, retained checks and user-owned campaign playtesting. Earlier plans describe original scope, not current deployment state; subsequent portal/performance delivery is recorded in the forward roadmap.

- [`2026-09-05-v1-1-to-v1-10-roadmap.md`](plans/2026-09-05-v1-1-to-v1-10-roadmap.md) — inherited foundation requirements, dungeon reliability and phone-playability scope. Preserve its acceptance requirements and decisions without restarting historical release queues.

- [`2026-09-07-progression-balance-and-investigations.md`](plans/2026-09-07-progression-balance-and-investigations.md) — original reward/drop/XP balancing and two-investigations-per-realm requirements; implementation and retained evidence are reconciled by the current release record, not this historical status text.

- [`2026-04-18-alpha-1-0-roadmap-and-status.md`](plans/2026-04-18-alpha-1-0-roadmap-and-status.md) — completed release-line tracker from `0.35.0` through `Alpha 1.0`
- [`2026-05-03-v1-0-implementation-plan.md`](plans/2026-05-03-v1-0-implementation-plan.md) — audit-grounded implementation and closeout record

Per-patch detail lives in `index.html` Patch Notes.

## Why this file is short now

Earlier versions of this doc duplicated content with the top-level `ROADMAP.md` and with the active plan docs under `docs/plans/`. The duplication drifted: each refresh updated some files and missed others. The single-source-of-truth structure is now:

- `ROADMAP.md` (repo root): product roadmap and current release-confidence status
- `docs/ROADMAP.md` (this file): one-paragraph engineering roadmap pointer
- `docs/plans/2026-09-28-alpha1-11-to1-99-release-roadmap.md`: current forward roadmap, beta/launch gates, decision register and future execution receipts
- `docs/plans/2026-09-05-v1-1-to-v1-10-roadmap.md`: inherited foundation requirements, dungeon repair acceptance criteria, and phone-playability release gates
- `docs/plans/2026-04-18-alpha-1-0-roadmap-and-status.md`: historical Alpha release tracker
- `docs/plans/2026-05-03-v1-0-implementation-plan.md`: historical Alpha implementation record
- `index.html` Patch Notes: per-patch history
- `docs/plans/live-browser-qa-checklist.md`: durable local, deployment, and live-character release gate

For forward scheduling, use the September 28 plan. It preserves explicit user decisions and inherited requirements; historical closeout claims do not override confirmed defects. Implementation, deployment, verification and user acceptance must be recorded separately.

## Architecture and review snapshots

For the architecture snapshot of `master` see [`ARCHITECTURE.md`](ARCHITECTURE.md). For the review of what is working and what is fragile see [`REVIEW.md`](REVIEW.md). Those two docs cover the engineering context that used to live here.
