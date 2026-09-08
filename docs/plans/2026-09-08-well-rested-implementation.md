# Well Rested — active implementation contract

Unreleased development branch after staged1.0.57. This document does not mark
the feature or a release complete. Server/client/aura/live acceptance must all
finish before publishing it under its own version.

Use an authoritative scene-scoped safe-zone registry, initially Lanternhold's
inclusive visible fence rectangle (X−100..100, Z100..300), shared by rest,
recovery, hazard protection, PvE and open-world PvP. Future zones register through
the same API. Dungeon coordinates never inherit overworld safety accidentally.

Connected living players earn one rest second per elapsed second inside a safe
zone, up to7200. Dead players do not earn rest; being inside still pauses expiry.
Outside, connected players spend elapsed duration even when dead. Disconnected/
logged-out players neither earn nor spend it. Persist fractional seconds in the
full character/journal snapshot; malformed or unknown saved versions fail closed.
Safe zones restore10% of the final maximum HP/MP each second, with fractional
resource carry and no passive-regeneration stacking. Corpses never regenerate.

## Stat map and arithmetic

Apply the modifier once after un-rested base/equipment/gem/set/resonance/talent
and active-status recalculation. Do not feed boosted attributes back into the
same derived calculation or modify saved base stats/equipment.

- Strength, Dexterity, Intelligence, Wisdom, Vitality, maximum HP/MP, displayed
  basic damage and defense: multiply by1.10, floor only at integer boundaries.
- Movement speed, casting speed and HP/MP regeneration rates: multiply by1.10.
  The existing permanent-stat movement cap is applied first; rest is a temporary
  speed modifier like the existing haste buffs, not a new permanent-cap formula.
- Attack throughput increases10%: divide seconds-per-attack by1.10 and update
  the authoritative attack cooldown. Existing base caps apply before temporary
  haste modifiers, as they already do for Zeal/Time Warp.
- Cooldown reduction receives a relative10% increase, retaining the existing
  50% ordinary/80% Time Warp bounds. Do not shorten already-running cooldowns.
- Fire/poison/holy damage, healing-done, lifesteal and resistance bonuses receive
  a relative10% increase (not ten percentage points). Crit chance is scaled once
  after equipment and applicable talents combine, retaining its100% probability
  cap. Skill-specific fixed mechanics/ranks are not independently multiplied.
- Levels, currencies, XP already earned, allocation points, item potency/ranks,
  visual size, attack reach and buff/debuff durations are not character stats.

Expiry/recalculation must never refill resources. Clamp values that exceed a
reduced maximum on expiry, retaining zero mana/death. Integer presentation rounds
down consistently with the existing combat-stat representation; no repeated
application may compound the modifier.

Apply the25% enemy-kill XP bonus after ordinary solo/party/difficulty/resonance
calculation for the recipient, before existing max-level conversion. Do not
multiply gold, manual quest turn-ins, investigation or room-clear payouts.

Implemented locally: replicated local/remote status and remaining duration,
desktop/phone buff text distinguishing accumulation, cap and outside countdown,
an Eidolon-specific golden/elemental mote halo using the existing High/Low status
effect lifecycle, and expiry/death/respawn disposal. The aura is hidden during
stealth so a cosmetic does not reveal a hidden Rogue. Network clients do not
award time or modify authoritative stats. Existing town-based persistence tests
must account for the newly requested recovery instead of disabling it to retain
old no-town-healing expectations. Real-input rested/unrested pacing, reconnect,
four-class stats and device/aura acceptance remain required.

## Development acceptance — September 8, 23:30 UTC

- Focused server/race protocol/reward tests passed (root1.438s/game3.929s);
  kill-only party rewards and level100 resonance conversion retain quest/gold
  exclusions. Generated JavaScript protobuf contract:12 tests passed.
- Full Go race suite76164 passed: root16.905s, game266.589s; no failure/restart.
- Full Jest44598 passed242 suites/3415tests121.714s; lint69906 passed.
- Presentation32110 passed61 tests including lifecycle/transparent hitbox,
  High/Low, stealth, explicit expiry and keyed phone timer/state updates.
- Hardware Chrome gallery81816 failed before startup because this new worktree
  had no prepared vendor runtime. Ran the existing prepare:client script;
  corrected52814 passed1/7.8s across all attached statuses, High/local and
  Low/remote. Screenshot inspected: golden small motes/foot rings, no box.
  Evidence: /tmp/eidolon-well-rested-gallery-prepared/animation-gallery-determin-667e3-e-actors-in-hardware-Chrome/procedural-status-well_rested.png.
- New opt-in real-session/restart test compiles; default run skips the external
  process test. It has NOT yet supplied actual-session acceptance.

Actual af7ed63/78308 FAILED43.834s: all four-class arithmetic checks passed,
but the capped player's full-recovery wait exceeded20s. Evidence
`/tmp/eidolon-compat-session-523788755/server.log` has no race/panic and a clean
shutdown drain; owned Mongo2332/volumes removed and independently absent.
The production loop passed a fixed0.033 to recovery despite slow race-instrumented
frames. Fixed rest/recovery to use a per-actor monotonic elapsed clock via
UpdateRealtime while preserving the fixed physics/combat step. Newly admitted
actors do not inherit time from before login; disconnect/resume resets the clock.
Simulated Update(dt) remains deterministic for unit probes. Corrected actual
session acceptance is still pending; do not weaken the full-recovery deadline.

Not a staged release: inherited1.0.57 metadata is unchanged and this branch must
not be published as57. Schema9 protects saved rest state from schema8 full-save
writers. Required before versioning: real sessions, existing resource acceptance
adaptation, offline behavior/parity decision and implementation, boundary travel,
phone rendered readability, scene lifecycle and final balance/gameplay checks.
