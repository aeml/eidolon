# Guardian Embrace: trained healing reach

Locally implemented after the preserved Alpha 1.0.36 candidate; not yet published
or included in `release/36-with-combat`. The wider roadmap and talent audit remain
open.

## Player-facing behavior

Battlefield Ministry now changes Guardian Embrace's actual periodic healing reach:
10m baseline, 10.3m at one rank, 11.5m at five. The radius is captured at casting
and follows the caster for the existing ten-second duration. Query and final
horizontal/body-padded tests agree; support-through-wall behavior is unchanged.
Both entity-copy paths, state/delta serialization and additive protocol field 113
carry the active radius, including for an observer joining after the cast.

A thin persistent perimeter marks healing reach at High and Low quality. The
body-sized decorative arms and seals stay body-sized. The one-shot cast effect
uses the accepted center/radius, while the persistent aura follows the actor.
Radius-only updates adjust the boundary without replaying the effect or resetting
its lifetime. Expiry clears active geometry.

Offline Guardian healing now follows the existing server base amount, equipment
then spell-talent rounding, poison reduction and missing-health clamp. It includes
self when chunk listings omit the player, filters hostile actors, and preserves
the shared cooldown-reduction calculation. Online/remote actors no longer apply
this offline heal loop. Other Cleric offline effects, duration talents and the
cleanse-only Purifying Wave healing-mastery mismatch remain separate open work.

## Verification and retained failures

- Before implementation, the actual server cast/tick boundary cases fail
  (`/tmp/eidolon-guardian-before-server.log`, 2.326s), and all nine initial client
  checks fail (`/tmp/eidolon-guardian-before-client.log`, 1.794s).
- Actual server tests cover ranks 0/1/5, ordinary and 4x bodies immediately inside
  and outside the boundary, accepted geometry, cast-time rank snapshots, both
  entity copies, movement and expiry. Protocol tests marshal/unmarshal the real
  message, test radius-only deltas, and clear inactive radius.
- Initial client follow-ups exposed fixture mistakes: HP above the actor's default
  max HP, then an expected raw cooldown ignoring existing 4% reduction. Fixtures
  were corrected without changing those game rules. Final focused checks pass
  71 tests / 5 suites in 1.720s; logs retain the earlier failed runs.
- Full client checks: **191 suites / 2,809 tests pass in 135.749s**,
  `/tmp/eidolon-guardian-full-client.log`. Full server race checks pass root
  **21.455s**, game **297.795s**, `/tmp/eidolon-guardian-full-server.log`. Lint and
  whitespace checks pass. A final test-only addition verifies actual ranked ticks
  heal friendly players/NPCs but not enemy, dead, other-instance or opposing PvP
  actors; focused Guardian server race checks pass in **3.277s**.
- The isolated `guardian-area` route uses normal branch/rank purchases and hotbar
  taps on a disposable, allowlisted readiness-prepared Cleric at 390×844. Actual
  accepted/persistent radii are 10m and 11.5m at both quality settings; actual server
  healing is 258 HP for this prepared character. A second browser joins after the
  cast, receives the trained radius without private talent ranks, and sees normal
  expiry. A fresh primary login preserves training.
- The first browser run reached every gameplay milestone but failed the unchanged
  browser-error guard with `ERR_NETWORK_CHANGED` module-load errors (48.2s body),
  `/tmp/eidolon-guardian-gameplay.log`. The precise host-network cause is unproven.
  One unchanged retry passes **51.6s** (49.6s body), including all error checks,
  credential scanning and isolated cleanup:
  `/tmp/eidolon-guardian-gameplay-network-repeat.log`.
- Inspected rank-zero High and rank-five Low captures show the full thin perimeter
  and unchanged center decoration. The phone HUD remains crowded by hints, text
  and debug/status information. This is cast/presentation evidence, **not** phone
  ergonomics, physical-device performance or full visual-polish sign-off.

## Next confirmed consumer

The diagnostic overlay now exercises Consecrated Ground. Its real zone tick still
misses a friendly actor at 6.8m with five Ministry ranks, despite the defined 5.75m
radius plus 1.25m body. The zero-rank control passes. The audit fails as intended
in 0.113s (`/tmp/eidolon-consecrated-area-probe.log`); no saved character is changed.
