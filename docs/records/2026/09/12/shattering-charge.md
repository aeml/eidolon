# Shattering Charge and dungeon impact boundaries

Development follow-up to `7f584d68`; not included in Alpha 1.0.63.

## Implemented

- Offline Shattering Charge now has a dedicated paid movement/impact path:
  28-unit planar range, 50 units/second travel, preserved floor height, canonical
  dungeon-floor clipping, and one impact at the actual landing.
- The impact uses the server base damage formula and named/generic damage
  training, then normal critical and recipient defense effects. Its flat
  five-point armor reduction expires after the cast-time trained duration,
  does not stack, and never permanently modifies equipment armor.
- Shattering Charge now consumes Technique, Lineholder Instinct and Enduring
  Rhythm area bonuses on both server and offline client. Base radius remains 16;
  five ranks in all three give 21.6 before recipient body radius. The client
  radius resolver agrees. This fixes an inert talent consumer, not a base buff.
- Preserve the original paid Technique cooldown instead of overwriting it in
  the legacy handler. Rejected/locked/authoritative casts cannot start offline
  travel. Friendly, remote, dead, inactive and other-instance targets are excluded.
- Offline death, scene changes and town movement recovery cannot leak a pending
  Shattering impact into another scene or ordinary Charge. Another ability
  cannot replace the paid Shattering cast during its travel.
- Recipient status/cooldown timers continue during travel. A new regression
  exposed cooldowns freezing during stun; cooldown prediction now counts down
  exactly once before the stun return, without locally ticking remote cooldowns.
- Authoritative Charge/Shattering damage, armor break and Shockwave knockback
  now check canonical floor connectivity at impact, including rechecking the
  recipient under its mutation lock. Charges still travel up to a legal wall
  endpoint; they do not hit or push an enemy through that wall.

## Evidence

- Initial offline regression: **13 failures, 12 controls**, 0.572 seconds,
  `/tmp/eidolon-shattering-red-20260912.log`. Many initial target-exclusion
  controls passed only because the old 3D travel had not arrived; the corrected
  tests execute actual impacts, including height-independent body boundaries.
- Initial offline implementation: 25 passing, 0.551 seconds,
  `/tmp/eidolon-shattering-green-20260912.log`.
- Expanded tests exposed two additional actual failures: cooldown pause during
  stun and an impact surviving a scene change (26 passed / 2 failed, 0.668s).
  `/tmp/eidolon-shattering-expanded-20260912.log`.
- Final focused client family: **13 suites / 240 tests passed**, 2.463 seconds,
  plus full ESLint, `/tmp/eidolon-shattering-family-final-20260912.log` and
  `/tmp/eidolon-shattering-lint-final-20260912.log`. Includes real paid travel,
  exact landing/speed/range, trained area and body edges, Mastery damage, trained
  duration snapshots despite retraining, critical/shield absorption, expiry,
  rejected casts, and cleanup. Source-size baseline checks pass.
- New actual-server tests reproduced missing ranked area and charge damage/
  armor break through walls: four failures, three controls, 0.196 seconds.
  `/tmp/eidolon-shattering-server-red-20260912.log`.
- Separate paid Shockwave test reproduced pushing an enemy through a wall:
  closed-wall failure / open-doorway control, 0.079 seconds,
  `/tmp/eidolon-shattering-shockwave-red-20260912.log`.
- New server regressions plus existing paid effect-duration/expiry tests passed
  three times under race detection, **18.242 seconds**. Expanded charge family,
  including movement ownership, rune effects, town recovery and reflected death,
  passed three times under race detection, **22.001 seconds**.
  `/tmp/eidolon-shattering-server-{green,family}-20260912.log`.

## Remaining gates

### Knockback path follow-up

Review of the first wall correction found a second boundary: an enemy could be
legally hit on the caster's floor, then be pushed across a gap into a disconnected
room because only the knockback endpoint was constrained. New paid Shockwave
tests reproduced this (closed-wall failure / open-doorway control, 0.074s):
`/tmp/eidolon-shockwave-path-red-20260912.log`.

The server now constrains the entire knockback path while the recipient still
holds its pre-knockback position, then applies the legal endpoint. The same
expanded charge family passed three times under race detection in **23.112s**,
`/tmp/eidolon-shockwave-path-family-20260912.log`. This follow-up changes no client
runtime. Full integration and publication remain required below.

Full combined client/server integration (including pending Wizard, Time Warp and
armor-reduction parents), native/browser appearance, earned pacing and release
packaging remain required. The old offline ordinary Charge and its runes are
not made fully server-equivalent by Shattering Charge's dedicated path; keep
their remaining damage/travel/area/rune audit open. No full/native local work ran
against the shared hardware while the release's required browser QA was active.

User phone feedback was recorded separately: on September 12 the user replied
“yes everything looks good” to the live-phone combat/menu playability question.
That is positive user-reported experience, not proof of every device, browser,
orientation, sustained performance or this unpublished combat branch.

The complete 1.1–1.10 objective remains open, and the cancelled soak stays off.
