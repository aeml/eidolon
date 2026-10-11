# Eidolon Engineering Roadmap

Last refreshed: October 11, 2026

This file is a short pointer. Last accepted public release: Alpha1.79.32,
exact `d31246e9b53fbe73bd7f59beea4c3235df30a922`, CI38136326810 attempt2.
All ten ordered jobs succeed; post-terminal normal-TLS frontend/backend identity,
ready database and all nine served asset hashes/byte counts match at12:33:35UTC.
[Acceptance](plans/2026-10-11-public32-terminal-qualification.json).
Attempt1's storage-preflight refusal and verified clean-scratch capacity repair
remain recorded; the unchanged2048MiB guard was not lowered.
[Failure and repair](plans/2026-10-11-release32-storage-preflight-recovery.json).
Qualified birch/recovery/support/Player Guide and content-authoring/lore work is
merged into local master, awaiting coherent publication.79 histories remain
unmerged; unfinished/rejected work stays isolated.
[Authoring qualification](plans/2026-10-11-content-authoring-qualification.json).
The [remaining register](plans/2026-10-09-release-readiness-remaining.md) retains
all inherited world/art/gameplay/device/performance/operations/F1–F5/beta/launch
requirements and historical failures. No freeze or beta acceptance is claimed.

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
