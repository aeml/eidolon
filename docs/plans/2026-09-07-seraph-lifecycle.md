# Avenging Seraph — summoned ally lifecycle

Status: isolated implementation on `work/seraph-lifecycle-20260907`, based on
preserved 1.0.42. Not packaged, merged into root or published. Full 1.1–1.10,
remaining talent consumers and phone acceptance gates remain open.

## Reproduction and server repair

Paid casts followed by real summoned-entity updates reproduce **seven failing
cases in 0.247s**, `/tmp/eidolon-seraph-before.log`: rank-one/five Mastery attacks
remain 70 instead of 72/84; five Technique ranks still expire before 16s; a dead
or disconnected owner leaves an attacking ally; changing instances leaves an
orphan; and a solid dungeon wall does not stop its 70-damage smite.

Summons now snapshot normalized damage training and duration at creation, without
rewriting saved ranks. The existing set extension remains capped at 300 seconds
and survives later equipment changes. Owner death, disconnect, removal or an
instance change removes the summon. Acquisition and impact use canonical floor
geometry; following clips the full movement segment and does not overshoot the
owner's three-unit following distance. The attacking summon retains its event
source while owner equipment/critical modifiers, threat and death credit remain
owner-owned. Summon lifetime is private server state, not a new wire field.

Expanded actual cast/attack/lifetime/following tests and the shared nine-case
server/client training contract pass under the race detector in **3.680s**,
`/tmp/eidolon-seraph-contract.log`. Earlier repaired checks pass 2.169s; those
precede normalization, set/critical/source and follow-segment controls.

## Offline implementation

The previous offline branch spent mana, overwrote the trained cooldown and
announced a summon without creating one. It now creates an actual
`AvengingSeraph` through the normal entity/mesh lifecycle, retaining the existing
procedural model. Its own actor update selects hostile targets, smites at the
normal cadence with owner attribution, follows the owner and expires. It does
not create or simulate a multiplayer replica. Locked/unaffordable casts cannot
create an ally, and owner disposal clears owned summons.

Source inspection establishes the missing offline entity; no separate pre-fix
offline Jest run is claimed. New paid-cast, cadence, expiry, owner/instance/death,
wall/door and authority tests pass, together with shared training and existing
Cleric/effect guards: **59 tests in 0.933s**,
`/tmp/eidolon-seraph-offline-contract.log`. Lint and whitespace pass. Seraph's
Technique copy now specifies duration rather than implying increased range.
Generic Cleric duration talent descriptions and other ability consumers remain
part of the broader audit, not silently declared fixed by this implementation.

## Remaining evidence

Full client/server regression, real browser casts/purchases/saved ranks, summon
model and attack presentation, owner-transition cleanup and offline rendered
play still require verification. Full offline damage-modifier parity is not
claimed by the shared summon base-damage/lifetime contract. Physical-phone and
earned character progression are separate from prepared summon QA.
