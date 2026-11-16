# Status Mastery and offline periodic consumers

Status: integrated into root at `4e05228` after isolated verification in
`work/status-consumers-20260907`. Packaged as the queued 1.0.42 candidate;
preserved 1.0.41 and earlier release branches are unchanged. Not published or a
full talent sign-off.

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

## Browser proof and targeting repair

The opt-in disposable `talent-status` browser route is added, not added to default
CI. It selects each ordinary Rogue specialization, casts against real enemies,
buys five Mastery ranks, verifies exact server tick amounts and checks fresh-login
persistence. This route is level-prepared functional verification, not earned
progression. Final local results on the same game runtime:

- Shadow Lunge: **69 / 82 / 82** baseline/trained/saved ticks, **21.3s**.
- Serrated Edges: **38 / 45 / 45**, **27.2s**. Both pass on `a37ae92`,
  `/tmp/eidolon-status-browser-viable-target.log`.
- Poison Coating: **67 / 80 / 80**, **30.9s**, on QA-only follow-up `f678061`,
  `/tmp/eidolon-status-browser-poison-hitbox.log`. Credential scan and cleanup
  pass. Each cast requires real hovered/request/server-event target identity,
  acceptance, positive cooldown and damage attributed to that caster/target.

Earlier failed runs are retained as `/tmp/eidolon-status-browser-*.log`.
The starter enemy died too soon for projectile coatings, so the route selects
natural durable Inferno Titans without editing enemy health. This exposed a
production bug: any dungeon entrance intersection immediately overrode live
enemy targets, regardless of depth. Two real-geometry raycast tests fail before
the fix (0.597s); entrance proxies now share ordinary interaction priority,
preserving enemy selection and entrance use after death. Combined targeting,
mobile and status checks pass 29 tests (0.985s).

Further driver failures distinguish moving, overlapping enemies, already-wounded
targets and the protocol's separate acceptance/result and cast-identity events.
Selection now samples exposed points on the actual hitbox, snapshots the hovered
actor at input dispatch, and retains strict identity/health/damage checks. No
raycast, ability or enemy state is directly replaced to make the test pass.
The final versioned combined run on `ef6f47d` also passes all three skills:
23.9s / 28.4s / 34.4s with the same baseline/trained/saved ticks, strict target
identity and clean artifact scan/cleanup. Log:
`/tmp/eidolon-release42-status-gameplay.log`. The opt-in route is not added to
default CI.

Final full client checks pass **211 suites / 3,112 tests in 73.485s**, plus lint,
on `a37ae92`; the later helper-only change has no game runtime difference. New
paid rune-only Piercing Throw controls confirm that inactive Serrated Edges
Mastery cannot boost the separate rune, with shared-contract race checks passing
**1.332s**. Go production source is unchanged from the full race pass above.
Close-Quarters Grace copy now states its existing 2% generic skill damage, without
changing server balance or saved ranks. Full 1.0.42 anonymous checks and ordered
CI/live deployment remain separate gates.

This does not close every status interaction or offline ability difference.
Raw Shadow Lunge/Poison Coating critical-Technique behavior, generic debuff
duration/copy discrepancies, unimplemented offline Seraph and Purifying Wave's
nonfunctional healing-only Mastery remain separate audit/design work. The
Purifying Wave choice has been sent to the user; other work continues meanwhile.
