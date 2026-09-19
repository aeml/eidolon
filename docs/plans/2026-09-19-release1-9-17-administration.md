# Alpha1.9.17 — the wardens have a desk

Candidate: cumulative administration batch following Alpha1.9.16. Publication
is not accepted until the exact GitHub run and live client/server identities
are verified. This release does not close the entire1.10 roadmap.

## Scope

- Server-role-gated launcher, bounded online-player list and filtered history.
- Durable login/resume/disconnect events and administrator action audits.
- Confirmed canonical items, bounded Gold, self/player/town teleports.
- Full-save, operation-receipt and audit recovery, including duplicate requests,
  lost replies, restart, role revocation and ordered cross-account work locks.
- Shared actual collision geometry, private-instance/VIP boundaries, authoritative
  scene height and recipient inventory/scene synchronization.
- Touch-sized controls, explicit review/reason and same-request retry.

Ordinary rewards, EP rules, cooldowns, resource recovery and the approved15-minute
dungeon logout policy are unchanged. Patch history remains in `index.html`.

## Accepted prepublication evidence

Detailed evidence is in [the administration record](2026-09-19-administration-console.md).
Reuse it rather than re-running previously accepted campaign or soak matrices.

- Focused game, handler, authorization, concurrency and recovery race tests.
- Real two-account socket operations and saved restart replay:99139PASS.
- Authenticated two-browser review/confirm, all operations, saved audit counts
  and recipient state:89594PASS29.53seconds.
- UI/scene/geometry tests and lint; version/UI284checks:67494PASS.
- Desktop/phone portrait/landscape layout controls:58104PASS.
- Schema14 archive restore with exact collections/documents/indexes and old
  schema12 writer refusal. Deployment must retain the consistent pre-upgrade
  database/private-journal/previous-image backup. Never start the old writer
  against the upgraded database or remove migration markers to bypass refusal.

## Publication checks

- Push the exact candidate to production through CI, not a manual hot replacement.
- One read-only Luna watcher reports the exact run's terminal result or failure.
- Check release manifest, login label, backend commit/version/database readiness
  and the workflow's live character result.
- Safe live administrator read-only smoke; do not grant or teleport production
  characters as a test. If operator credentials are unavailable, request a manual
  panel read check rather than giving production QA accounts administrator roles.
- Record accepted live evidence separately; keep broader raids/campaign/actual
  phone party/dungeon work open.
