# Fresh ability input after a hovered entity expires

The repeat-character Wizard native rehearsal at 1a491c41 failed its first
pass, then passed the second (50.5 seconds / 1.7 minutes). Inferno Cataclysm
was ready, unlocked, funded, and had valid ground aim, but the retained hover
was an inactive Meteor. Hotbar input captured that expired entity; the
orchestrator correctly rejected an unavailable explicit target. The hotbar
must instead distinguish a stale pointer sample from deliberately captured
actor intent.

Fresh hotbar and primary casts now ignore inactive hover samples and use the
ordinary ground intersection. Facing uses the same validity rule. There is
no forced aim point if the ground ray misses. Living targets retain their
identity; queued casts whose original actor later dies or expires remain
cancelled rather than silently retargeting. Self-casts and selected party
support targets retain their existing paths. No damage, cost, cooldown,
range, server protocol, or saved state is changed.

## Evidence

- The focused regression initially reproduced both problems: hotbar sent no
  cast; primary sent the expired projectile ID and its position.
- The tests run real Wizard/Actor ability prediction, checking the ordinary
  network payload, mana payment, cooldown and production effect dispatch.
  With the fix, six suites / 61 tests pass in 3.69 seconds, including buffered
  identity, mobile party support, pending casts and multiplayer authority.
- Initial test cost expectation omitted its required base-cost argument;
  corrected to the controller's canonical cost before the green run. The
  original red failures were the missing/wrong network requests, not cost.
- Failed native artifacts retained at
  `/tmp/eidolon-rune-reuse-failure-4dKZge`; original log
  `/tmp/eidolon-release65-rune-reuse-native-20260912.log`.
- Focused logs: `/tmp/eidolon-stale-hover-{red,green}-20260912.log`.

Native repeat-character verification and full regression remain required.
This is a candidate for 1.1.0, not a new 1.0.66 release. Production remains
1.0.65 until a separately accepted release. This does not claim to explain
the separate low-frame moving-cast sample or accept the unfinished four-role
dungeon clear.
