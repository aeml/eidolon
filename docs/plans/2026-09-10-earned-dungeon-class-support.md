# Earned dungeon coverage for all four classes

Status: isolated QA implementation and focused checks passed. Full regression,
prepared input confirmation and earned native class playthroughs remain pending.
No gameplay/server, version, deployment or active Wizard-run source was changed.
Built separately from primary4b3991ff while its original earned run44188 continues.

## Scope

The strict story-only dungeon mode previously rejected Rogue and Cleric even
though their earned preparation and overworld combat drivers already existed.
This candidate enables all four class routes without relaxing level30, completed
Earth chapters, no-dailies, normal layout, all-four-boss, manual turn-in, raid
access, login and required Water handoff checks. Unknown classes still fail.
Original phase, encounter, survival and world-update watchdogs remain unchanged.

`createEarnedDungeonCombat` retains the exact existing Wizard/Fighter driver
objects. For Rogue it composes the existing ranged escape with Poison Coating;
for Cleric it gives the existing immediate Healing Light priority, then considers
Guardian Embrace below85% health. These are baseline QA build choices, not optimal
builds or balance conclusions. Overworld behavior is unchanged.

Support requires a living hostile in ordinary basic-attack range, an unlocked
skill in one of four real hotbar slots, actual adjusted mana cost and ready
cooldown, no active copy of the buff and spacing from the last accepted cast.
Self projection and ordinary mouse/hotbar input are used; no fabricated events,
socket commands, stats, resources, skill unlocks or status effects. Attempts are
throttled and do not renew any combat/phase deadline. Accepted and rejected
server cast receipts are counted once, retained for death/turn-in diagnostics,
and the observer forwards the unchanged message to the actual game handler.

## Focused evidence

Session99031 passed118tests/6suites1.616s followed by lint underNode24.18.0.
Logs `/tmp/eidolon-earned-dungeon-classes-unit.log` and
`/tmp/eidolon-earned-dungeon-classes-lint.log`.

Coverage includes availability/cost/cooldown/active-effect gating, unsupported
classes, self-aimed ordinary input and no state mutation, defensive priority,
attempt throttling, missing projection, original Wizard/Fighter ownership,
server-result forwarding and observer reinstall without duplicate counts.
Actual Bash route tests preserve all strict flags and failure propagation for
all four classes; earned-route tests retain full normal clear-before-reward
ordering and failure prevents turn-in. Mocked browser observations are not
actual ability acceptance or a class-clear result.

## Remaining acceptance, in order

1. Do not merge into the active primary run or compete with its browser/heavy
   workload. Preserve its result, artifacts and exact source identity first.
2. Run complete client regression and lint on this candidate; reconcile any new
   primary fixes without discarding the current failed/passed evidence.
3. Verify both added drivers against a real isolated server using explicitly
   prepared, allowlisted class fixtures: actual paid Poison Coating, actual
   healing/Guardian Embrace, cooldown/active suppression and no invalid targets.
   Such fixtures prove input semantics, not earned campaign progression.
4. Complete separate ordinary fresh Rogue and Cleric story/dungeon playthroughs
   under the same original limits. Retain seed, gear, skills, costs, accepted/
   rejected casts, deaths, dungeon clear and manual reward/save/Water receipts.
   Do not grant levels/items, weaken encounters or call basic-only success proof
   of a support ability that was never actually used.
5. All-class cooperative/party, later realms, four raids/crystal events and Dark
   King progression remain required. Versioned release/pipeline/live checks and
   the full1.10 roadmap are not closed by adding these two QA drivers.
