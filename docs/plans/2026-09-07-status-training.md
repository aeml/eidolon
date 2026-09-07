# Status Mastery and offline periodic consumers

Status: implemented in `work/status-consumers-20260907`, isolated from preserved
1.0.41 and earlier release candidates. Not published or a full talent sign-off.

## Actual server applications

Paid casts and real projectile flights reproduce six ignored-rank expectations
in **0.236s**. Baseline and unrelated-rank controls pass:

| Skill | Baseline tick | Rank-one tick, expected | Rank-five tick, expected |
|---|---:|---:|---:|
| Shadow Lunge / ROG_07 | 100 | 100, 104 | 100, 120 |
| Serrated Edges / ROG_13 | 57 | 57, 59 | 57, 68 |
| Poison Coating / ROG_21 | 98 | 98, 101 | 98, 117 |

Mastery now changes the application-time damage snapshot, not every subsequent
tick. Raw Shadow Lunge and Poison Coating receive applicable generic and matching
skill damage. Serrated Edges derives from a modified projectile hit and adds only
its own Mastery; it does not reapply inherited generic/equipment/rune/critical
modifiers. It cannot gain this Mastery from the Serrated rune alone while the
Serrated Edges buff is absent. Invalid, duplicate legacy, oversized and cross-class
ranks cannot inflate the new calculation. Saved ranks are never rewritten.

Expanded actual applications cover normal Shadow Lunge, Serrated Edges with
Piercing Throw and Fan of Knives, and Poison Coating with Piercing Throw and the
ordinary asynchronous basic attack. Zero/one/five/unrelated/generic/combined
builds retain authoritative tick amount/source after training changes. Expanded
race checks pass **4.127s**, followed by shared Go/client contract coverage
passing **4.182s**. Full server race passes (root **8.048s**, game **190.252s**).
The later shared-contract test is additional evidence, not included in that
earlier full race count. Production Go source is unchanged since the full run.

## Offline consumers

Five actual paid cast/flight/attack cases fail initially (**0.614s**): missing
application snapshots leave old stack-based constants instead of skill damage.
Offline Shadow Lunge, coated Piercing Throw/basic attacks and Serrated Piercing
Throw/Fan of Knives now use matching base formulas and trained wound snapshots.
Coatings are checked at projectile impact; dead recipients are not re-wounded.

Recipient-owned tick processing runs before the stun early return, retains its
attacker for real on-kill effects, clips elapsed time to the wound lifetime,
preserves cadence on refresh and clears damage/source on cleanse or expiry.
It cannot apply or simulate damage for multiplayer/remote actors or an
authoritative engine. Criticals are not rerolled on every stored tick. A lethal
bleed invokes its owner's Vampiric effect once, with no extra poison/corpse kill.

Focused client lifecycle/contract/actual-consumer checks pass **29 tests in
0.920s**. Full client regression passes **211 suites / 3,109 tests in 79.330s**;
lint and whitespace pass. An initial lifecycle test used an unsupported Jest
matcher; replacing it with separate count/argument assertions fixes the test,
not game behavior. Logs use `/tmp/eidolon-status-*.log`.

## Remaining gate

The opt-in disposable `talent-status` browser route is added, not added to default
CI. It selects each ordinary Rogue specialization, casts against real enemies,
buys five Mastery ranks, verifies exact server tick amounts and checks fresh-login
persistence. This route is level-prepared functional verification, not earned
progression. Browser results are pending before release packaging.

This does not close every status interaction or offline ability difference.
Raw Shadow Lunge/Poison Coating critical-Technique behavior, generic debuff
duration/copy discrepancies, unimplemented offline Seraph and Purifying Wave's
nonfunctional healing-only Mastery remain separate audit/design work. The
Purifying Wave choice has been sent to the user; other work continues meanwhile.
