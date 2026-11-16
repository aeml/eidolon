# Four-role dungeon targeting — unreleased QA correction

The failed native run on `3c1085b8` remains a failure: the Rogue died at the
Rootbound Warden, last observed at 5,191 / 15,000 HP. Archived evidence is in
`/tmp/eidolon-four-role-current-failure-qn4hV2`. Seed `7522185662117066327`,
generator 2, Normal Verdant. No later boss, manual quest turn-in or fresh-login
completion is implied.

## Corrected diagnosis

The earlier dagger/melee theory was incorrect. Rogue and Wizard basic attacks
have a 16-unit base range in both `Constants.js` and `combat_attack.go`, plus
large-target padding. The runtime attack-follow loop stops within its computed
range. Server threat selection can pursue a damage dealer, but aggregate damage
does not prove who held threat when the Rogue died. The captured damage records
previously omitted the attacker's position.

The damage-role driver did have an unsafe assumption: `projectEntity` proves a
point is on the canvas, not that the boss is under the pointer. Left/right clicks
at that point could select a covering actor or move toward ground. This is a
source-level gap, not proof that occlusion caused the archived death.

## Correction and evidence

- Damage roles now acquire a witnessed hover on the actual hitbox, trying its
  exposed sides when covered. No direct targeting/state/network mutation.
- Each input reads current survival, warning and cast-range state; after the
  basic attack it checks hover again before the primary cast. A projected but
  unacquired target produces no click. Normal basic-attack approach, game-owned
  admission, difficulty, equipment and all completion assertions are retained.
- A bounded diagnostic records the attacker's observed position, distance and
  state at incoming damage, plus current movement/pending interaction. Recent
  damage-role inputs record actual hover, basic reach and movement intent.
- Initial RED was a missing new helper export (zero tests ran), not a native
  reproduction of the boss failure. Focused helper/healing/movement checks then
  passed 110 tests in 3 suites, 0.584 seconds; full lint passed. Final expanded
  focused results are in `/tmp/eidolon-party-pointer-final.log`.
- `TestReportedDungeonSeed` passed for the archived seed and generator. This
  validates that seed's geometry, not combat. Native entry still generates a new
  normal instance; do not describe the next browser run as a fixed-seed replay.

Logs: `/tmp/eidolon-party-pointer-{red,green,final,lint,seed-replay}.log`.
The full four-role native route is still required: every room/boss, all four
alive, individual kill credit, manual Ilyra turn-in and Water offer, then fresh
login without a duplicate reward. No soak or production changes are part of this
QA correction. Alpha 1.0.62 remains the last accepted production release.
