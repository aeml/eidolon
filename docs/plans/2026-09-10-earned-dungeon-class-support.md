# Earned dungeon coverage for all four classes

Status: isolated QA implementation, full client regression and prepared native
input confirmation passed. Earned native class playthroughs remain pending.
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

### Full and native acceptance — September 10, 11:41 UTC

On frozen506d1c9a, full42440 TERMINAL0:296suites/4174tests129.636s, then lint
underNode24.18.0. Logs `/tmp/eidolon-class-support-full-{client,lint}.log`.
Prepared native32340 TERMINAL0: Rogue1case16.4s, Cleric1case17.0s, serial and
zero retries. Actual final credential scan0; owned containers and
API18580/Mongo18581/web41980 listeners absent after cleanup. Archive
`/tmp/eidolon-prepared-support-proof-9vbe4p` retains both scoped result trees,
final HTML report, native log and full regression/lint logs. Inspected both PNGs:
Rogue's coating and Cleric's healing aura/positive heal text are visible. Cleric
is beside/partly covered by entrance geometry with the cutaway visible; this is
not a new approval of entrance art, gameplay-size readability or phone rendering.

Rogue paid30mana(1585→1555) for one accepted PoisonCoating. Cleric paid25mana
for each of two HealingLights and40mana for GuardianEmbrace; healing events
recorded387direct and258per Embrace tick. No rejected casts. Stale-target and
active-effect suppression assertions passed using the actual composite drivers.
This is explicitly prepared level100/protected input evidence, NOT earned class
progression, poison damage, independent cooldown-only suppression or survival.

Primary earned44188 ended in a second Warden survival failure before this native
check started. Its eight readiness phases pass, but gear upgrades alone did not
resolve the boss. Preserve its failure; do not immediately repeat long all-class
campaigns without resolving the short diagnostic questions in primary's failure
plan. The geometry diagnostic subsequently added to primary is not in506d1c9a.

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

Follow-up: the defensive/support attempt throttle now prevents rejected healing
and support from alternating continuously and starving ordinary combat input.
The combined10suite focused run passed162tests2.455s plus lint. A subsequent
prepared-route contract run passed84tests/4suites1.366s, lint and Playwright test
discovery (one parameterized-by-class case). Logs are
`/tmp/eidolon-earned-dungeon-classes-final-{unit,lint}.log` and
`/tmp/eidolon-support-native-contract-{unit,lint}.log`, with discovery in
`/tmp/eidolon-support-native-discovery.log`. These are not browser execution.

Final source check26032 TERMINAL0:166tests/11suites2.529s, then lint and one-case
Playwright discovery; `git diff --check` also passed. Logs
`/tmp/eidolon-class-support-final-{unit,lint,discovery}.log`. This includes the
native spec's stale-target check before activation, not masked by an active buff.

## Prepared native route (implemented; initial native acceptance above)

`EIDOLON_ISOLATED_QA_ROUTE=prepared-earned-support` runs separate allowlisted
Rogue and Cleric accounts, serially with zero retries and separate artifact
directories. It stops on either class's failure. It is explicitly opt-in and
not inserted into an earned route or used to replace the complete release gate.
The spec also requires the dedicated prepared flag before logging in.

The existing level100, Verdant waypoint/protection and readiness commands are
explicit fixtures. Branch selection, approach, self aim and composite-driver
casts then use ordinary controls, without refilling during the observation.
The case requires a real visible hostile in attack range, no support requests
for a stale target before activation, paid server-accepted support, Cleric's
actual Healing Light and Guardian Embrace heal events, and active-effect
duplicate suppression. It records accepted/rejected results and normal outgoing
requests without changing their payloads. Poison damage, isolated cooldown-only
suppression after natural buff expiry, survival and a dungeon clear are NOT
proven by this case. The cooldown-only negative remains covered by policy tests
until separate native evidence is added.

The original concurrency restriction was honored: the route and full regression
started only after primary44188 was terminal and its failed evidence preserved.

## Remaining acceptance, in order

1. Integrate with primary's post-failure diagnostics without discarding either
   native result or original source identity. Re-run merged client regression
   and lint; the separate candidate's full pass does not cover changed source.
2. Resolve short Wizard/resource/retreat diagnostics before another long earned
   replay. Keep all survival, phase, encounter and state-stall limits unchanged.
3. Add native poison-damage and independent cooldown-only evidence as needed;
   current prepared acceptance proves paid activation/healing and active-effect
   suppression, not those additional effects or earned campaign progression.
4. Complete separate ordinary fresh Rogue and Cleric story/dungeon playthroughs
   under the same original limits. Retain seed, gear, skills, costs, accepted/
   rejected casts, deaths, dungeon clear and manual reward/save/Water receipts.
   Do not grant levels/items, weaken encounters or call basic-only success proof
   of a support ability that was never actually used.
5. All-class cooperative/party, later realms, four raids/crystal events and Dark
   King progression remain required. Versioned release/pipeline/live checks and
   the full1.10 roadmap are not closed by adding these two QA drivers.
