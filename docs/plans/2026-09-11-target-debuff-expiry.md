# Enemy vulnerability and armor-break expiry

Unpublished follow-up to the Rogue-duration sourcef3fa593a; this is not part
of Alpha1.0.62's active release. Full roadmap and native party gates stay open.

## Reproduction

Eight actual paid cases reproduced expired modifiers remaining on enemies:
Cleric Mark of Weakness and Heaven's Trumpet, Wizard Scorch Beam and Fighter
Shattering Charge, each with/without a longer stun. Actual resource payment,
application, nonzero damaging hit/charge landing and still-active controls all
passed before the failed expiry assertions. The prepared test advances only
the effect deadlines, then runs the recipient's ordinary update. RED0.040s:
`/tmp/eidolon-target-debuff-expiry-red.log`.

These statuses, like the earlier Rogue mark/accuracy bug, expired only in the
player branch. Enemy update never cleared their vulnerability/armor penalties.

Offline paid Cleric/Rogue mark and Smoke Bomb cases then reproduced paused
debuff countdowns under a longer stun:5/5 failed0.599s. Actor.update returned
for stun before reaching those timer blocks. Log
`/tmp/eidolon-target-debuff-offline-red.log`.

## Repair

The recipient expiry helper now covers Rogue mark/accuracy plus Cleric
vulnerability and armor breaks, and is renamed accordingly. Enemy/NPC and
player paths use it; enemy expiry runs before a stun can suppress AI. Expiry
clears flag/value/deadline at the exact boundary, including missing deadlines.
No spell damage/duration, paid-cast geometry, CC immunity or schema is changed.

Offline recipient mark, slow, root, accuracy and healing-penalty countdowns now
run before the stun early return. Removed their old later update blocks so
unstunned actors do not decrement them twice. Timers clamp at zero and expired
modifier factors clear. Existing replicated visual countdown behavior remains;
this adds no local outgoing damage calculation or server-authority bypass.

## Focused evidence

- Three-repeat Go race1.792s for paid lifecycle, actual post-debuff attack
  damage, exact/missing boundaries and prior Rogue duration/expiry controls.
  A100-damage ordinary attack against50 defense deals60 with the active20%
  mark,55 with the active five-point armor break, and50 after either expires.
  Actual ordinary scheduled impacts are awaited, not substituted.
- Expanded three-repeat Go race15.738s includes observer-state snapshots,
  prior raw-wound, receiving-defense, parallel-wound, status Mastery and
  duration/replication checks. Active/expired vulnerability reaches the player
  view and an earlier snapshot does not alias the mutable entity.
  Logs `/tmp/eidolon-target-debuff-expiry-{green,broad}.log`.
- Initial client4suites/40tests1.234s plus lint passed. Final client4suites/
 42tests1.246s plus lint PASS adds root/healing-penalty once-per-update controls
  with/without stun; its log is
  `/tmp/eidolon-target-debuff-offline-final.log`, with full lint in
  `/tmp/eidolon-target-debuff-lint-final.log`.

The parent Rogue-duration run76281 terminated exit1: client346suites/4835tests
and lint passed, but an old Piercing Throw test had a mark without a deadline.
That invalid prepared mark expired; its exact damage-bonus assertion failed.
Follow-upfff67cae replaces it with real paid mark/projectile casts, preserving
the50% bonus assertion; three race repetitions1.047s passed. Merged the entire
follow-up, including the failed full-run record, into this branch without
conflicts. One new combined full regression is required; do not call the failed
parent run accepted or duplicate full/heavy/browser executions.
Native observers, saved characters, full four-role
Verdant/manual turn-ins and earned balancing are not proven by these fixtures.

## Unreleased patch-note draft

Enemy vulnerability marks and armor breaks now expire correctly, even while
the enemy is stunned. Offline debuffs also count down during stun instead of
lasting longer than intended; expired penalties no longer affect later hits.

## Remaining scope

The still-open full-tree audit includes Cleric duration consumers, other
generic description/benefit mismatches, non-damaging/Serrated Techniques and
complete offline rune/armor/spread/receiving parity. This repair does not claim
all classes or160 talents are accepted. Keep1.1–1.10, phone/pacing/save/native
and two-floor casino requirements intact. The cancelled soak stays stopped;
the designated GPU is reserved for62 predeploy/live QA.

## Combined full regression accepted on8bb0e0cd

48892 terminated exit0 on unchanged8bb0e0cde90dc115552bf54a3b5fa2dc35bfac63.
Full client347suites/4842tests passed153.656s, full lint passed, and Go race
passed root20.984s/game348.206s/loadtest1.019s/database1.093s/lifecycle1.023s.
Logs `/tmp/eidolon-target-debuff-full-{client,lint,server}.log`.

This combined pass includes the corrected paid Weak Point fixture and accepts
both the preceding Rogue-duration stage and this enemy/offline expiry stage
for local full regression. The failed parent run remains preserved above.
It does not accept the later Cleric-duration work, native party/save/phone
gates or deployment. This source remains separate from62's active release.
