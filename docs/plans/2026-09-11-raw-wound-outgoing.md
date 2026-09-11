# Raw wound outgoing modifiers

Unpublished follow-up on the full roadmap integration53127f25. This is not
part of the already-pushed Alpha1.0.62 release and does not close the entire
talent, combat, four-player dungeon or1.1–1.10 scope.

## Reproduction

Actual paid Shadow Lunge and paid Poison Coating followed by an ordinary attack
or Piercing Throw ignored their matching critical Technique. The deterministic
server threshold fixture kept equipment chance at55%, selected a roll between
55% and65%, and compared baseline, rank-five matching and unrelated builds.
All three trained applications failed before the change. Both coating deliveries
also stored98 rather than147 with a50% poison equipment bonus. These are real
application/tick consumers, not substituted damage functions. Initial server
RED log: `/tmp/eidolon-raw-wound-outgoing-red.log`.

Offline real Rogue/Imp casts reproduced the same five failures plus combined
Mastery/generic damage/Technique/equipment composition (127 rather than381).
Six tests failed in0.567s before the client correction; log
`/tmp/eidolon-raw-wound-offline-red.log`.

## Change

Raw Shadow Lunge, legacy Shadow Strike and Poison Coating budgets now carry
their skill and damage type into the existing outgoing calculation. Generic
and matching damage training applies once, followed by the ordinary critical,
independent Lucky, unique/set/target/element modifiers and recipient PvP limits.
Shadow Strike now also receives applicable generic status training. Poison
spread retains the immutable attacker snapshot and calculates each recipient's
own raw application; it does not inherit the primary recipient's mark or cap.

Serrated Edges, Poisoned Fan and Magma remain inherited-hit budgets: no second
ordinary critical, equipment multiplier or65% PvP scaling is introduced.
Applied entity wounds still store their final outgoing amount, and each tick
uses current receiving defenses without recalculating caster bonuses.

Offline raw wounds use the existing critical helper and their available Lucky,
Executioner, Fortress-set and poison equipment fields at application. Derived
wounds skip that step. Receiving marks remain owned by the existing offline
recipient handler; this patch does not claim complete server/offline mark,
rune, spread or receiving-defense parity. No saved schema or live data changes.

## Focused evidence

- Initial server green: three repetitions,2.696s, including prior raw/inherited
  PvP/Magma controls (`/tmp/eidolon-raw-wound-outgoing-green.log`).
- Expanded paid composition and critical PvP cap controls: three repetitions,
 3.705s (`/tmp/eidolon-raw-wound-outgoing-composition.log`).
- Broader status/training/poison/bleed/receiving defenses/parallel wounds and
  critical contracts: three race repetitions,20.781s
  (`/tmp/eidolon-raw-wound-outgoing-broad.log`). This preceded the final added
  paid spread composition test; that test has its own log.
- Final paid basic/projectile spread composition: three race repetitions,
 1.134s. Primary294 and separately marked recipient441 remain snapshotted
  after caster/mark changes (`/tmp/eidolon-raw-wound-spread-composition.log`).
- Client:5suites/67tests1.369s plus full lint PASS. Real critical Serrated
  projectile/Fan controls prove inherited damage is not rerolled; raw tests
  cover matching/unrelated Technique, poison equipment, combined training,
  Lucky/Executioner/set effects and unchanged subsequent ticks. Logs
  `/tmp/eidolon-raw-wound-offline-final.log` and
  `/tmp/eidolon-raw-wound-lint.log`.
- The first added offline Executioner/projectile control found a fixture bug:
  its flight loop assumed10000 starting HP despite intentionally preparing
 2500HP. Corrected the loop and hit assertion to use captured pre-impact HP;
  did not substitute impact or reduce expected damage. Retained failed evidence
  `/tmp/eidolon-raw-wound-offline-composition.log` and corrected final logs.

Full current-source regression and native/save/party acceptance remain required.
The parent53127f25 did pass its full integration run49901 (client344suites/
4804tests162.228s, lint, Go race root19.446s/game331.143s plus remaining packages),
but that is not full acceptance of this later change. No browser or dungeon
clear is claimed from these focused tests. The soak remains cancelled.

## Unreleased patch-note draft

Shadow Lunge and Poison Coating now benefit from their critical-chance talents.
Poison Coating correctly uses poison-damage equipment bonuses. Wound damage
snapshots bonuses once when applied, preserving PvP limits and preventing
derived bleeds and burns from multiplying already-critical hits a second time.

Still required: status duration/copy consistency, remaining non-damaging and
Serrated Technique semantics, native feedback/save coverage, full four-role
Verdant acceptance, earned pacing, physical phones and later roadmap stages.
