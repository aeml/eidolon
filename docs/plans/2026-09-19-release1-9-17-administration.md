# Alpha1.9.17 — the wardens have a desk

Delivered: cumulative administration batch following Alpha1.9.16. CI
`35464162303` passed all ten jobs at
`b5feba27cdf6de984446032aedfefeb286df5a0f`, including live character QA.
Both public domains independently report that SHA and Alpha1.9.17; the backend
reports database ready. This release does not close the entire1.10 roadmap.

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

### Verified delivery

- All ten jobs of CI `35464162303` passed, including predeploy and live
  character checks. No further rerun is needed for documentation changes.
- Independent public reads confirmed `play.eidolonrealms.com/release.json`
  and `server.eidolonrealms.com/healthz` at the exact commit/version above,
  healthy database, and the served login label, cumulative patch-note entry
  and Administration launcher. The launcher remains server-role-gated.
- Deployment job `105956951361` reported schema preflight 12 → 14 and a
  consistent recovery point at
  `/home/aeml/eidolon/server/backups/save-upgrade-20260919T194926Z-kFOYTa`.
  Its protected directory and COMPLETE marker were independently checked;
  the marker names this exact commit and `2026-09-19T19:49:29Z`. The deployment
  backup verified its database, recovery files and previous-image checksums.
  No backup contents or production credentials were read for this acceptance.
- September20: the operator opened Administration, found Activity history and
  confirmed that it all appears to work. The safe live read-only panel/history
  check is accepted. Disposable authenticated mutation/browser proof remains
  accepted; no production QA administrator grant or mutation was required.
- Full 1.10 identities and remaining campaign/raid integration remain open;
  physical-phone follow-up is deferred at the player's request. Delivery of
  this patch does not close the broader roadmap.

### First candidate and correction

- Candidate `f76b0a601dfd99d9839657b5925a7c1777da86f4`, CI run
  `35462943697`, finished failed before deployment. Go, Jest and browser
  shards 1/3 and 3/3 passed; shard 2/3 failed because the anonymous mobile
  menu test tried to scroll to the intentionally hidden Administration button.
  All deployment jobs were skipped; this candidate was not published.
- The corrected test explicitly requires Administration to stay hidden for an
  ordinary account and still checks every normal menu button. The dedicated
  admin layout fixture covers authorized presentation. The focused six-case
  mobile/admin layout run (local session 2957) completed; its persisted
  `test-results/.last-run.json` reports `passed` with no failed tests.
- The replacement candidate also includes QA-only commit `0dca7e84` for
  walking around an occluded dungeon target. Its focused 109 tests passed;
  this is not evidence of a completed raid and does not close the raid gate.
- Replacement `441b3ffa`, CI `35463942707`, stopped at client tests: the
  dungeon-entry unit fixture mocked the helper module without its new
  `settlePointerRaycast` export. The other 462 suites / 6,924 tests passed.
  Updating that mock preserves the entry assertions and runtime behavior;
  all 133 related tests across six suites now pass (session 93038, exit 0),
  with changed-file lint and whitespace checks. No release was accepted.

### Required live acceptance

- Push the exact candidate to production through CI, not a manual hot replacement.
- One read-only Luna watcher reports the exact run's terminal result or failure.
- Check release manifest, login label, backend commit/version/database readiness
  and the workflow's live character result.
- Safe live administrator read-only smoke; do not grant or teleport production
  characters as a test. If operator credentials are unavailable, request a manual
  panel read check rather than giving production QA accounts administrator roles.
- Record accepted live evidence separately; keep broader raids/campaign/actual
  phone party/dungeon work open.
