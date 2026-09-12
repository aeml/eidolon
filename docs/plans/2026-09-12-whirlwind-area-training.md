# Whirlwind area training — 1.1.0 candidate, not release acceptance

Parent: `06f62f1b`. Separate worktree/branch `work/1-1-whirlwind-area`.
This closes a reproduced talent consumer gap within the existing foundation
scope. It is not a new ordinary 1.0.x release or a completed 1.1.0 milestone.

## Behavior

Whirlwind Technique (`FTR_04`) already promises 2% area and 3% skill cooldown
reduction per rank. The authoritative pulse query and hit check nevertheless
used a fixed six-unit radius. Generic Fighter area training (`FTR_33` and
`FTR_38`) also failed to affect Whirlwind. Actual paid-cast edge tests reproduce
the gap: the two untrained controls pass and ten trained cases fail.

The paid cast now snapshots its trained radius, from 6 to 6.6 with Technique
alone, or 8.1 with all three area talents maxed. The first and subsequent pulses
use the same snapshot, including body padding and dungeon line-of-sight checks.
Later build changes cannot enlarge or shrink an existing spin. Mana, cooldown
reduction, rune durations, exact damage budgets and pulse cadence stay intact.
Expiry clears the stored radius. Invalid/legacy stored values use baseline 6.

The accepted cast publishes radius/arc at the caster position. Protobuf field
123 carries active `whirlwind_radius` for late observers, using the existing
binding generator. Full snapshots, radius-only deltas, and all three world
copy paths retain the public footprint without exposing private pulse budgets
or hit lists. Inactive state publishes zero and ignores stale private radius.

Offline casts use the same trained radius and preserve their cast-time snapshot.
Local prediction uses the normal area metadata; authoritative corrections resize
the existing moving spin in place, without restarting animation or duration.
High/Low observer presentation consumes public radius, not private talents.
Partial updates retain known radius, legacy/malformed packets use baseline,
float32 rounding is tolerated, and expiry still removes the effect. A cast
event arriving after its snapshot does not create a second effect.

## Evidence

- Actual cast RED: ten trained edge cases fail, with paid-cast/central-hit
  controls intact (`/tmp/eidolon-whirlwind-area-server-red-20260912.log`).
- Initial server Whirlwind race checks pass 9.660s. The expanded wire check
  catches an omitted third copy path, `World.GetState`; adding that field fixes
  the omission, rather than removing the copy assertion. Corrected race checks
  pass game 8.344s and protocol 1.877s.
- Client final focused checks: eight suites, 130 tests pass in 4.773s. Coverage
  includes actual offline paid casts at ranks 0/1/5, generic ranks 0/5, base and
  Extended runes, geometry world scale, protobuf delivery, delta-like updates,
  malformed values, late-event ordering, and adjacent Roar/ability consumers.
- Full lint and generated bindings pass. Final server rerun also includes an
  explicit fully trained Extended wall-negative control, ordinary one-point
  purchases, sixth-rank rejection and all three copy paths; game race passes
  9.010s and protocol race passes 1.763s.

Logs use `/tmp/eidolon-whirlwind-area-` with suffixes
`server-{green,wire,final,accepted}-20260912.log`,
`client-{green,expanded,final}-20260912.log`,
`generate-20260912.log`, and `lint{-final}-20260912.log`.

## Remaining acceptance

Full hosted regression, native system-Chrome trained-area purchases and live
release acceptance are not established by these focused tests. The existing
`dungeon-whirlwind` native route exercises duration and movement but does not
yet prove trained-area purchases or fresh-login persistence. Extend and execute
that coverage when the production predeploy GPU job releases the single native
queue. Do not run a competing browser job or claim this patch is deployed.

Proposed 1.1.0 patch-note bullet: “Whirlwind's area upgrades now increase its
actual hit radius, with matching visuals for the caster and other players.”
