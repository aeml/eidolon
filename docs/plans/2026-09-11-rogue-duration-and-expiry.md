# Rogue duration consumers and enemy debuff expiry

Unpublished follow-up on accepted full-primary1418a20d. Not part of the already
pushed Alpha1.0.62 release. This repairs another portion of the open full-tree
combat gate; it does not complete1.1, the four-role dungeon or1.1–1.10.

## Reproduction and intended contract

Dirty Tricks (`ROG_28`, five ranks) already defines4% generic skill duration per
rank on the server, but Rogue timers remained fixed. Its old client description
incorrectly promised bleed/poison damage. Keep saved IDs/ranks and the existing
server duration definition; wire actual consumers and describe that benefit.
No talent reset or replacement investment is introduced.

Paid direct casts reproduced22 trained failures across11 buff/debuff/rune
deadlines, with all rank-zero and unrelated controls passing:0.043s,
`/tmp/eidolon-rogue-duration-direct-red-corrected.log`. An earlier fixture used
the nonexistent shadowlunge_slow rune; corrected it to the actual Cripple ID
and reproduced on unchanged runtime rather than counting invalid controls.

Paid on-hit casts then reproduced eight trained failures: coating via basic/
Piercing Throw, Serrated via Piercing/Fan, Serrated/Poisoned/Weighted rune
statuses and Tripwire. All baselines passed:0.117s,
`/tmp/eidolon-rogue-duration-onhit-red-corrected.log`. Initial Tripwire fixture
sat exactly at the strict2-unit hit boundary and never triggered; moved the
prepared target inside the unchanged trap radius, preserving real cast/impact.

Paid Weak Point Mark and Smoke Bomb also reproduced a baseline lifecycle bug:
their mark/accuracy flags persisted forever on enemies because expiry existed
only in the player branch. Both failed0.026s after real application and active
controls (`/tmp/eidolon-rogue-debuff-expiry-red-corrected.log`). The earlier
log was a test declaration compile error, not runtime failure evidence.

Offline actual Rogue/Imp cast/timer and copy tests failed12/12 before correction,
0.836s (`/tmp/eidolon-rogue-duration-offline-red.log`). This also exposed missing
offline Cripple and Lasting Shadow rune duration consumers.

## Implementation

Direct buffs/debuffs and on-hit roots/slows/wounds resolve applicable duration
once at application using the existing shared server helper. Rune-authored
base duration comes first; later rank changes do not alter applied deadlines.
On-hit coating/rune consumers use the existing immutable owner combat snapshot
captured at impact; this patch does not introduce a new launch-time snapshot
policy or change projectile travel, delayed volley timing or trap lifetime.
Poison spread retains the primary application's already-resolved deadline.

Enemy/NPC and player updates now share Rogue mark/accuracy expiry. It runs
before stunned enemy AI can return, clears expired deadlines and uses the
same exact-boundary behavior. It does not broaden cleanse/hostility or CC
immunity rules. Other classes' target-debuff lifecycles still need auditing.

Offline Dirty Tricks applies to Rogue buffs, debuffs, trap roots and raw/
inherited wounds, with rank normalization and authoritative-replica guards.
Cripple now supplies its slow timer and Lasting Shadow supplies its ten-second
base before duration training. The corrected tooltip describes4% ability-effect
duration per rank (20% maximum), not a damage bonus. Saved schemas unchanged.

## Focused acceptance

- Direct duration/expiry: three race repetitions1.068s. Expanded direct/on-hit
  suite: three repetitions1.328s. Broader duration/status/poison/wounds/receiving
  defenses/parallel checks: three race repetitions32.363s.
  Logs `/tmp/eidolon-rogue-duration-{direct-green,server-green,server-broad}.log`.
- Client final6suites/89tests1.781s and full lint PASS. Actual paid status
  consumers cover duration ranks, unchanged per-tick damage, unchanged remaining
  duration after rank changes, and an additional earned tick inside the extended
  lifetime. Authority/wrong-class/non-finite/fractional/capped ranks tested.
  Logs `/tmp/eidolon-rogue-duration-client-normalized.log` and
  `/tmp/eidolon-rogue-duration-lint-final.log`.
- Exact-boundary and paid stunned-enemy expiry controls are included in the
  broader server run. Prepared fixtures are not native combat/save acceptance.

Full current-source client/lint/server regression is next. The prior full raw-
wound pass belongs to98b6cb8e, not this later duration implementation. Keep local
GPU free for62's actual release QA; the interrupted soak remains cancelled.

## Unreleased patch-note draft

Dirty Tricks now extends Rogue buffs, debuffs and wound durations as defined by
its talent, and its tooltip correctly describes the benefit. Weak Point Mark
and Smoke Bomb's accuracy penalty now expire on enemies, including stunned
ones. Offline Cripple and Lasting Shadow now apply their missing timed effects.

## Remaining scope

Native purchase/feedback/expiry/save proof, full four-role Verdant/manual quest
turn-ins, earned balance and physical phones remain required. This is not full
offline rune/spread/receiving-defense parity or all160 talents. Read-only review
also found Cleric Mark Weakness expiry still confined to the player branch;
reproduce its actual enemy lifecycle next, along with remaining armor-reduction
and other target timers. Rogue non-damaging/Serrated Technique benefits and
remaining generic description/consumer mismatches are still open. No later
roadmap release or required two-floor casino scope has been removed.
