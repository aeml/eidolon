# Consecrated Ground: the circle and the zone

Local follow-up to Guardian Embrace, after the preserved 1.0.36 candidate. Not yet
published. Full regression and isolated-gameplay checks pass as recorded below;
publication still requires an ordered versioned candidate and its CI/live gate.

## Behavior

Battlefield Ministry now scales the actual holy-zone radius after rune selection:
5m baseline, 5.15m at one rank, 5.75m at five; the Expanded rune becomes 8.625m with
five ranks. Existing zone tick code consumes the resolved radius for both healing
and enemy damage, including body padding. Existing damage-blocking dungeon walls
and support-through-wall behavior remain unchanged. The zone is centered at the
caster's accepted position and remains there after the caster moves.

The accepted cast publishes its center/radius/full-circle arc. The persistent
projectile uses its existing replicated scale (radius / 5), so observers do not
need private talent ranks to reconstruct the trained circle. No new protocol field
is needed for this spell. Both entity copies retain that scale.

Offline play now retains the shared cooldown, snapshots trained/rune area, keeps
the holy-zone art visible for its lifetime, and disposes it on expiry/cancellation.
Lingering keeps its existing doubled duration. Real ticks include self and friendly
actors, use horizontal/body-padded reach, and block enemy damage across disconnected
dungeon floors. Healing consumes existing equipment/talent bonuses, poison and
missing-health clamps; the base damage matches the server. The offline damage
mastery/derived-damage pipeline and Sanctuary's defensive effect remain open;
this work does not claim complete offline rune or talent parity. Cleric duration
talents are a separate outstanding category.

## Regression evidence

- The retained overlay first fails the ranked 6.8m friendly target in **0.113s**
  (`/tmp/eidolon-consecrated-area-probe.log`). After implementation the same probe
  passes in **0.126s** (`/tmp/eidolon-consecrated-after-probe.log`).
- Before implementation, the expanded actual server cast/tick suite fails in
  **3.446s** (`/tmp/eidolon-consecrated-before-server.log`). It covers ranks 0/1/5,
  all four rune choices, ordinary/4x bodies, inside/outside healing and damage,
  accepted center/shape, scale/copy snapshots, rune duration/Sanctuary and expiry.
  Final focused race checks, including existing ground-wall and healing tests,
  pass in **16.561s** (`/tmp/eidolon-consecrated-focused-server.log`).
- Initial client coverage fails **10/10 tests in 1.959s** before the implementation
  (`/tmp/eidolon-consecrated-before-client.log`). The corrected runtime passes
  **114 tests / 4 suites in 2.729s**, including Guardian, Wizard ground shapes and
  procedural projectile regressions (`/tmp/eidolon-consecrated-focused-client.log`).
  Expanded holy-ground checks pass **13 tests in 1.082s**: real offline ticks,
  persistent geometry/lifetime/cleanup, wall-versus-doorway damage and retained
  friendly healing, plus actual protobuf decoding/entity sync and rendered world
  boundary for a rank-private observer (`/tmp/eidolon-consecrated-expanded-client.log`).
- Lint, shell syntax and whitespace checks pass before final gameplay.
- Full client checks pass **192 suites / 2,822 tests in 156.761s**,
  `/tmp/eidolon-consecrated-full-client.log`. Full server race checks pass root
  **22.926s**, game **322.243s**, `/tmp/eidolon-consecrated-full-server.log`.
  Final lint, whitespace and shell syntax checks also pass.
- The isolated `consecrated-area` browser route passes **57.3s** (55.1s body),
  `/tmp/eidolon-consecrated-gameplay.log`. A disposable level/readiness-prepared
  Cleric uses normal branch selection, Ministry purchases, rune selection and
  hotbar taps. Accepted/persistent radii are 5m High, 5.75m Low and 8.625m Expanded
  High, each with actual 74 HP server healing. Normal zone expiry is awaited
  between casts; training and the equipped rune persist through fresh login.
  Browser-error checks, credential scanning and isolated cleanup all pass.
- Inspected Expanded High and trained Low captures show the persistent perimeter
  and detailed holy motif. They also retain an intrusive level-up hint and crowded
  phone HUD; actor size/readability and phone ergonomics are not signed off. The
  route is browser touch emulation, not a physical-device performance measurement.

## Remaining area batch

The open diagnostic overlay advances to Blessing of Resolve, Blessing of Zeal
and Heaven's Trumpet as a group. All three ranked actual casts fail at the expected
new boundary while their rank-zero controls pass (0.494s,
`/tmp/eidolon-cleric-immediate-area-probes.log`). Existing saved ranks are preserved. Promoting
one repaired consumer never establishes completion of all class areas, the full
160-talent audit, dungeon progression, phone ergonomics or the 1.1–1.10 roadmap.
