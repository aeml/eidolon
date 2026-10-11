# Eidolon Engineering Roadmap

Last refreshed: October 11, 2026

This is a short pointer to the [remaining-work register](plans/2026-10-09-release-readiness-remaining.md).
Alpha1.79.37/exact`fac6489a76fd0baf99f0f6181c7e7da381110e7b` is merged and pushed. CI38167079786attempt1 is active;36remains last accepted.448distinct focused checks/six suites and eight native publication cases pass, retries/skips0. All12versions align;472notes preserve471prior entries byte-exact.86asset pins are prepared. [Publication](plans/2026-10-11-release37-publication.json).

Alpha1.79.36/exact`aee9c3dba85da6f11555439a3ad4476597aaada3` is accepted live. CI38161891123 attempt1 passed all ten jobs. Fresh normal-TLS checks at18:52:03UTC match frontend/backend identities, ready database and all82served asset hashes/byte counts. Four optional stages remain skips.448distinct prepublication focused checks/six suites and four native publication cases pass, retries/skips0;12versions align and471notes preserve all470prior entries byte-exact. [Publication](plans/2026-10-11-release36-publication.json). [Acceptance](plans/2026-10-11-public36-terminal-qualification.json).

Forge gem keyboard choices and identity/focus continuity are qualified and merged locally as`eeade50f` for a later coherent milestone.68distinct focused checks/seven suites and four distinct Chrome desktop/phone cases pass; one reproduced reorder-visibility failure and original fixture correction are retained. Included in pushed37; deployment acceptance pending. [Qualification](plans/2026-10-11-forge-gem-keyboard-qualification.json).

Merchant buyback keyboard and price controls are qualified and merged locally as`49b50d7b`. Native item buttons show quantities and exact total Gold prices, preserve focus/scroll across refresh and reordering, and refuse obsolete, ambiguous or invalid choices.65focused checks/five suites and two Chrome desktop/phone cases pass;359mandatory browser cases are discovered exactly once. Included in pushed37; deployment acceptance pending. [Qualification](plans/2026-10-11-buyback-keyboard-qualification.json).

Completed Gold boundary history is ordinarily merged as`6422b422`, preserving current earned-credit helpers; four current Go-race subcases pass.595of654local branch names are merged;59still require individual review, down from287unmerged. Completed validated work must be merged into master before being declared done. [Reconciliation](plans/2026-10-11-gold-boundary-history-reconciliation.json).

Previous accepted public release: Alpha1.79.35, exact
`ade204b800faa2cba8eacf1da71b100590e88d87`, CI38154778403 attempt1.
All ten ordered jobs succeed. Fresh post-terminal normal-TLS frontend/backend
identities, ready database and all78served asset hashes/byte counts match at
17:02:13UTC. Four optional stages remain skips.
[Acceptance](plans/2026-10-11-public35-terminal-qualification.json).
Coherent35 combines qualified guild/venue/build-menu/direct-trade work.
728distinct focused checks/17suites and two native publication cases pass;
12versions align35;470cumulative notes preserve all469prior entries byte-exact.
[Publication](plans/2026-10-11-release35-publication.json).
[Prepublication](plans/2026-10-11-release35-menu-review-prepublication.json).
592of653local branch names are ancestors of master;61unmerged histories remain
under individual review. Completed content-validation, environment and selected Earth ground histories
are merged and included in the pushed36 milestone. Prior34 failures remain
retained in its historical acceptance receipt.
The complete world/art/gameplay/device/
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
