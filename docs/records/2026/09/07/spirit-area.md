# Spirit Guardians: trained reach without oversized cherubs

Local work after the preserved Alpha 1.0.37 candidate; not yet published or included
in `release/37-with-protection`. Local regression and gameplay verification pass;
publication remains separate from this implementation checkpoint.

## Implementation

Spirit Guardians and Boost snapshot their talent-adjusted radius and selected rune
at the actual cast. Base reach is 16m / 20m; five Ministry ranks produce 18.4m / 23m,
or 27.6m / 34.5m with Expanded. The same resolved radius drives spatial queries,
final body-padded periodic damage, healing-set reach and the accepted caster-centered
cast event. An already-active cast does not change size when ranks/runes change.
The existing boosted combo state is resolved before taking that snapshot.

Both entity-copy paths retain boosted state, radius and active rune. Additive
protocol fields 114/115 carry radius/rune to observers without private talent data.
Full-state and radius/rune-only delta comparisons include them; inactive state
exposes zero radius and an empty rune. Duration-only/radius-only updates no longer
reset a running aura to a fresh full duration.

The persistent ring is exact rather than growing 1.5% with its opacity pulse.
Cherubs retain their body scale, shared geometry and wing animation. Their orbit
remains inside the resolved perimeter. Radius-only changes replace/dispose only the
ring geometry; they do not recreate the cherubs or replay the cast. Rune/boost
variant changes continue to rebuild the existing group as needed.

Offline casts preserve shared cooldowns and snapshot radius/rune. Their first
eligible update pulses, followed by the 500ms cadence. Planar/body-padded damage
respects dungeon cover, uses the existing server base/boost/Vengeful amounts, and
does not apply the old offline-only boosted slow. Multiplayer actors never run this
offline damage loop. Expiry/cancellation clears the radius, rune and scene resources.

## Scope limits

This does not establish complete Spirit damage-mastery, duration-talent, offline
healing-set/Sanctuary or PvP parity. The existing server damage loop still targets
enemy entities, not opposing player entities; the PvP damage consumer remains open.
The set-healing path retains hostile-player protection. The combo regression uses
explicitly unlocked opener/closer skills and a test clock advance; normal
cross-branch combo access is not proven by it. Phone ergonomics and the broader
visual/1.1–1.10 roadmap remain open.

## Evidence

- The four ordinary/Expanded base/Boost diagnostic casts fail ranked reach in
  **0.798s** (`/tmp/eidolon-spirit-area-probes.log`), with passing rank-zero controls.
- Expanded actual cast/tick tests fail before the repair in **5.215s**,
  `/tmp/eidolon-spirit-before-server.log`. They cover ranks 0/1/5, all four rune
  choices, ordinary/4x bodies just inside/outside the area, accepted center/shape,
  both copies, post-cast build changes, movement and expiry.
- Initial client checks fail **9/9 in 2.431s**,
  `/tmp/eidolon-spirit-before-client.log`. Final focused checks pass **35 tests /
  3 suites in 2.927s**, `/tmp/eidolon-spirit-focused-client.log`: real offline
  casts/ticks, High/Low geometry, unchanged cherub identity/size, ring disposal,
  late-observer state, radius-only duration preservation, walls and expiry.
- Focused server race checks pass root **1.069s**, game **6.599s**,
  `/tmp/eidolon-spirit-focused-server.log`. Additional cases cover actual healing-set
  ticks at trained reach, hostile/dead/other-instance protection, dungeon walls and
  boosted combo geometry. Protocol tests marshal/unmarshal the real message and
  check radius-only, rune-only and inactive deltas.
- Lint, shell syntax and whitespace checks pass before the isolated browser run.
- Full client regression passes **194 suites / 2,875 tests in 174.847s**,
  `/tmp/eidolon-spirit-full-client.log`. Full server race checks pass root
  **16.928s / game 367.003s**, `/tmp/eidolon-spirit-full-server.log`.
- The isolated real-server phone route passes **1.2 minutes**,
  `/tmp/eidolon-spirit-gameplay.log`, with normal talent purchases, rune selection,
  base/Boost casts, High/Low effects, a separate late-joining browser, expiry and
  fresh-login persistence. Browser-error and credential guards pass; the route
  exits successfully with temporary-container cleanup. This town route does not
  demonstrate damage against an enemy; actual tick tests cover that separately.
- Inspected normal-rank-five and Expanded-Boost Low screenshots show the retained
  small cherubs and exact outer perimeter. They also expose intrusive level-up
  guidance, long guardian labels and excessive HUD occupancy. This is not a
  visual or physical-phone sign-off; the shared phone composition needs more work.
- The repaired four-variant diagnostic batch passes in **0.653s**,
  `/tmp/eidolon-spirit-after-probes.log`, before promotion to the ordinary tests.
