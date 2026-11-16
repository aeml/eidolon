# Charge and Unstoppable — 1.1.0 baseline repair

Status: implemented and focused-regression verified on development, **not
published or natively accepted**. Built from primary960c4936 in
`work/1-1-offline-charge`. This belongs in the consolidated1.1.0 milestone,
not another1.0.x release. Existing development version metadata is not a
release claim.64/65 candidates and production remain unchanged.

## Confirmed defects and changes

- Ordinary offline Charge used legacy25speed, unlimited3D aim, radius3,
  strength-based damage and no rune behavior. It also skipped elapsed actor
  timers while traveling. Replaced with50speed, planar28range, fixed16radius
  plus body-edge checks, impact-time trained damage, and one impact. Movement
  and impacts respect connected dungeon floors. Friendly, dead, inactive,
  remote and other-instance recipients are excluded.
- Momentum extends the clamped displacement50% and scales damage with actual
  traveled distance, capped at double damage at30units. Shockwave uses its
  separate5radius/4unit push, respecting immunity, immovability and the entire
  knockback path. The visible offline destination now uses the actual clipped
  landing rather than the original aim point.
- Unstoppable captures rune and duration at the paid cast, protects travel,
  restores prior immunity at impact/cancellation, then grants20% armor for
  the trained5-second duration. Equipment armor stays intact, repeated casts
  refresh instead of stacking, and the timer expires even while stunned.
  Death, cancellation, scene/authority changes and externally cleared travel
  flags cannot produce a delayed offline impact or orphan travel immunity.
- Server Unstoppable already recordedRuneArmorBuff=.2 and its deadline, but
  neither armor consumer used it. A real enemy attack against the paid buff
  dealt105 instead of85damage (boss153 instead of143, with100base armor and
  5armor melt). Shared effective armor now applies the active bonus before
  flat melt and existing boss/Backstab penetration. Expired deadlines stop
  helping immediately at impact without waiting for an update. No equipment
  mutation or universal spell-armor mitigation was added.

## Verification

Client initial RED16failed/10passed0.911s. Integration required an explicit
unlocked Charge in the prepared fixture, and the damage test was corrected
to distinguish Shattering-specificFTR_21 from genericFTR_38. These are test
precondition/expectation corrections, not new Charge balance changes.

Final expanded client PASS8suites/189tests2.428s plus changed-file lint and
diff whitespace. Includes actual attack impact with active/expired paid armor,
multiplayer authority, critical consumers, Shattering, Fighter status timers,
body edges, walls, every Charge rune, rejection and cancellation cases.
Logs `/tmp/eidolon-1-1-charge-{red,expanded-client,lint}-20260912.log`.

Server RED reproduced both live-buff mitigation failures while expired
controls passed. Final focused race suite PASS12.510s, covering the Charge/
Shattering family, paid armor receiving ordinary/boss attacks, actual Backstab
and Eviscerate, equipment changes and exact-deadline expiration, plus existing
shield and enemy-debuff consumers. Logs
`/tmp/eidolon-1-1-charge-{server-red,final-server}-20260912.log`.

These are prepared functional tests, not earned progression, real-party clear,
native presentation, or overall balancing acceptance. Full integrated client/
server and browser/native regression remain required. Keep local native/full
work off the hardware while production64 still runs its normal release gates.

## Player-facing notes to include when 1.1.0 ships

- Charge now behaves consistently in offline combat, including Momentum,
  Shockwave and Unstoppable, with correct landing indicators and dungeon walls.
- Unstoppable's temporary armor now actually reduces incoming armor-mitigated
  damage and expires correctly without altering equipped gear.

Keep the complete1.1 dungeon/party, earned pacing, reconnect and balancing
gates, followed by all1.2–1.10 requirements, including the physical casino.
