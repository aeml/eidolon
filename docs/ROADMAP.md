# Eidolon Engineering Roadmap

Alpha 1.79.62 is prepared, not yet deployed: qualified Bastion cap/root
detail and phone garment text-size support, with saved-session wardrobe coverage
and a verified Pages upstream TLS template/private checker enrolled in CI.
[Bastion qualification](plans/2026-10-16-bastion-caps-and-roots-qualification.md),
[phone qualification](plans/2026-10-16-garment-phone-text-qualification.md),
[saved-session qualification](plans/2026-10-16-garment-saved-session-qualification.md),
[TLS qualification](plans/2026-10-16-pages-upstream-tls-qualification.json).
Existing host TLS activation remains pending administrator execution of the
[operator guide](operations/pages-upstream-tls.md); publishing the template
does not change the installed Nginx configuration. Accepted public Alpha1.79.61
remains at `a60c8e916`. Earlier transport findings and the full original game/
readiness requirements remain open. Alpha access is unchanged; soak/stress and
human pacing/physical-phone feedback remain deferred.


Alpha 1.79.61 at `a60c8e916` is deployed and verified within the Bastion
entrance and analytics startup scope. All ten CI jobs pass: 785 client suites /
12,042 tests; 451 hosted browser passes / 13 skips; 88 native passes / one skip;
and first-attempt live, recovery and party passes. Fresh normal-TLS checks match
359 asset pins, both identities, a ready database, open registration and flat
terrain at 2026-10-16T08:18:03.708942+00:00.
[Acceptance](plans/2026-10-16-release1-79-61-acceptance.md).
Earlier transport failures and full original game/readiness gates remain open.
Soak/stress and human pacing/physical-phone feedback remain deferred.


Current delivery and unfinished work are recorded in the
[remaining-work register](plans/2026-10-09-release-readiness-remaining.md).
Alpha1.79.60/exact`800f3acef` is deployed and verified within guild-menu continuity
and inactive invitation preparation scope. All ten CI jobs pass;356normal-TLS
pins/identities/readyDB/open alpha/flat terrain match after a targeted read of
one initialHTTP408. A configured live geometry-load retry also remains retained.
[Acceptance](plans/2026-10-16-release1-79-60-acceptance.md).
Public alpha access remains unchanged; full original requirements stay open.
Soak/stress and human pacing/physical-phone feedback remain deferred, not passed.
The earlier [documentation-push finding](plans/2026-10-16-receipt59-redeployment-finding.md)
remains historical evidence; accepted61 is the current serving source. The60receipt remains historical evidence.

Prior dated deployment checkpoints are retained in
[the preceding roadmap pointer](https://github.com/aeml/eidolon/blob/2f5b4ad71d4cbd5709a199d51bc4529b8d28228a/docs/ROADMAP.md)
and the source-scoped receipts in the register.

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
