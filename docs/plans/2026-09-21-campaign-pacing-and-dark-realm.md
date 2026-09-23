# Approved campaign pacing and Dark Realm expansion

September23: Alpha1.9.30 is verified live atcdf45e3a; CI35826334400, complete live
QA and independent public identity/assets checks passed. It delivers the
expedition and initial XP tuning. The
connected first expedition chapter and fresh opening checks have passed. The
historical pause below records the user's previous stopping point, not a new
pause request. Full pacing and campaign/raid acceptance remain open.
Implementation-stage descriptions below are historical; the current delivery
status above supersedes their local/not-deployed labels.

September21 decision: approximately100 hours to level100, then8–12 hours of
Dark Realm quests/lore, including the dungeon leading to the Dark King raid.
Aim for roughly112 hours overall. Level100 is required before realm entry.
The finale remains5–10 minutes across four phases for five well-geared players.
This is required remaining1.10 work, not delivered1.9.29 content.

The [initial XP tuning candidate](2026-09-21-campaign-xp-tuning.md) now changes
incoming combat/fresh-daily rewards without changing stored levels or thresholds.
Reference modeled active progression is approximately93–109 hours depending on
party/rest assumptions, not a measured duration or final balance approval.

## Implementation in progress — shared realm foundation

Local server work now defines a permanent `dark-realm` scene with a Resonant
Foothold camp and four connected, authored districts. The circuit has one
canonical floor layout for movement, projectile paths and delayed attacks;
it is deliberately not a party-owned dungeon or eligible for room-clear rewards.
The camp uses the existing safe-zone healing/Well Rested system. An Ilyra
projection supports local, manual story acceptance and turn-in with the same
chapter-order, proximity and duplicate-reward rules as town.

Personal entry requires level100 and four completed crystal repairs. Existing
Nexus/Dark King veterans retain their earned access, but not an exception to
level100. Login restores valid district positions or repairs invalid positions
at the camp; ineligible saved entrants return to town without changing their
quests, resources or rewards. The private dungeon/raid fifteen-minute rule is
unchanged. Admin visits now support the shared realm only after normal personal
entry: both players must already be inside, and the recipient's level/story
eligibility is checked again when the durable move applies. Canonical floor,
discovery-wall and live-occupancy checks constrain the landing. This is not a
party summon or a new way to bypass the guide's unlock.

This is **not a finished or published expansion yet**. The initial foundation
had no district encounters or authored campaign; the integration below now adds
them. Remaining release work includes inhabited district presentation, connected
character acceptance and coordinated pacing. No100-hour rebalance or8–12-hour
playtime claim follows from this foundation. Do not repeat a long earned route
merely to verify an isolated content/scene change.

Focused server evidence: the Dark Realm, manual quest conversation, movement/
projectile and safe-zone selection passed in24.647s; server dungeon scene/resume
regressions passed in2.489s. Coverage includes the connected circuit, no shortcut
across the void, personal/veteran access, shared entry without reward changes,
Recall, invalid saved-position recovery, preserved valid district positions,
rejected remote/busy/dead entry, manual local turn-in and duplicate-reward guards.
This is automated server evidence, not a rendered scene or end-to-end campaign
acceptance. No long native run was launched alongside the1.9.29 deployment.

### Client scene and entry slice

Local client work now consumes the authoritative circuit as one non-overlapping
floor surface, uses a dedicated open-air scene with four district silhouettes
and elemental camp lanterns, and selects Umbral atmosphere by scene identity
rather than overworld coordinates. The guide exposes the server's personal
eligibility flag and sends a character-authenticated, rate-limited entry action.
Only the caller moves; an existing party dungeon is neither reset nor replaced.
The restored-crystal/Nexus dialogue now distinguishes opening the expedition
portal from breaking the wards around Malachar's raid court.

Fourteen scene/menu unit tests passed17.478s, server action/policy coverage
passed0.328s, scoped lint/diff passed. A short anonymous rendered fixture passed
14.3s after1.9.29 deployment completed: desktop camp/city and low-quality phone
camp. Images are under
`test-results/dark-realm-presentation-Da-f636c-inates-on-desktop-and-phone/`.
This is geometry/presentation evidence, not authenticated expedition or physical
phone acceptance. Visual review found the districts still too sparse: populate
them with authored quest landmarks, inhabitants and encounters before release.
Do not treat the passing render smoke as final art approval or8–12-hour content.
After the narrative distinction and shared fixture extraction,40 focused client
checks passed10.429s (scene, menu, conversations), with scoped lint clean. The
short render case is registered in the existing animation smoke manifest.

## Authored campaign integration — local, not deployed

The campaign now has55 ordered chapters: the existing31 plus24 Dark Realm
chapters before the Nexus. One authoritative JSON source supplies Go and a
checked, generated client catalog. Each of the four districts has six chapters:
three investigations, two hunts and one collection. The12 investigations contain
38 individually saved discoveries. Four new soulbound items each have their own
bag icon. Ordinary level100 Shades/Reavers populate all four districts, avoiding
the discovery approaches; this is a shared overworld, not a party-owned run.

Ilyra's acceptance/completion dialogue follows the king's protection bargain
through refugee records, edited testimony, the memory foundry and the city whose
morning never ends. The expedition reconnects Dain/Tovin, the town witnesses,
Maelin and the four Eidolons. The final investigation directs the player back to
the town guide for the Nexus. An optional post-victory conversation describes
the survivors' choices without adding rewards or reviving Malachar.

Fresh characters need the final expedition turn-in before Nexus entry; every
party member is checked before creating a run. Existing accepted/completed Nexus
or finale contracts retain access at level100, even when earlier records are
missing. Missing added chapters become optional, not completed. Existing reward
quotes, collection counts/pity and earned resources are preserved. Shared-realm
party credit uses the existing110-unit radius; private dungeon-wide credit and
the15-minute logout expiry are unchanged.

Client discovery requests now retain the actual scene identity; delayed replies
after Recall cannot open stale records. The world map and radar draw server
floor geometry instead of the elemental overworld, with accepted unrecorded
discoveries marked on the map. The outdoor floor now uses muted masonry rather
than the Nexus's repeating luminous fractures; all floors still share one union
and continuous world UVs. The new tide-lens prop uses existing native geometry.

Evidence:

- Focused Go checks across all packages (`Test(DarkRealm|Chronicle|PartyKillCredit|.*DungeonEntry)`)
  passed; game package4.948s. Further Dark Realm checks passed0.733s, including
  actual party death rewards, all-member Nexus gating and saved partial contracts.
-204 client checks across11 suites passed12.627s. Additional map/scene/content
  checks passed45/45 in3.147s; conversation/aftermath32/32 in2.658s. Lint passed.
- Native discovery/scene fixture passed7.7s after the paving change, with desktop
  shelter and low-quality phone lens screenshots inspected. The prior fixture
  failure was a plain Actor without a mesh type; it now uses the real Wizard
  class. Two icon/tracker browser cases passed in the earlier23.5s combined run.
  These are anonymous presentation fixtures, not earned progress or physical
  phone acceptance. No long raid/dungeon retry or production mutation was needed.

The first connected isolated run (`darkexp0921a`, source `b8695cc7`) reached the
shared realm through the real guide but failed at Ilyra's interaction. The
client's periodic legacy cleanup recognized only town quest-giver IDs and
removed the expedition projection from active chunks. The cleanup now retains
her authoritative ID, and the connected regression waits through a cleanup tick
before interacting. This was an application defect, not an earned campaign
failure; prepared prerequisites and production accounts remain untouched.
The corrected run (`darkexp0921b`, source `bfb3c1f2`) passed the cleanup-tick
regression, real Ilyra acceptance and map, then recorded the ferry manifest and
shelter cups through movement/E input. It died en route to the third record:
the new harness used move-only travel and never defended against pursuing
enemies. It now invokes the existing normal Wizard shielding/crowd-control/
attack travel driver before steps and reading. No enemies, resources, objective
credit or survival assertion were weakened. The full corrected route still
needs a passing receipt; do not repeat it unchanged or describe two records as
completed chapter acceptance.

Admin boundary tests passed (game6.951s), including same-shared-scene/no-party
visits, rejected entry/level/story bypass, eligibility changes before durable
apply, receipt replay, floor bounds and every grounded discovery wall. Generated
geometry matches the actual client collider builders (Jest1/1,8.378s), with
Dark Realm walls separate from overworld shapes. Scoped lint/diff checks passed.

### Expedition residents and readable foothold

Local content now includes Maelin and Scout Ren at the arrival camp, and Captain
Elin, Clerk Oss, Furnace Tender Vara and Baker Oren beside the corresponding
district records. Each has an initial optional conversation, a discussion unlocked
by its specific recorded discovery, and a post-King response. Their voices cover
the costs of rescue, complicity, endless labor and safety without a future; none
replaces Ilyra, offers services, grants rewards or auto-completes an objective.
Town witnesses remain in town. Interaction requires the witness's own scene,
physical proximity, a living reader and an active entity.

Four smaller elemental lanterns and two canvas supply/sleeping shelters now sit
near the arrival point. Their footprints are shared by client walking and the
generated administrative landing checks; spawn, Ilyra and camp residents remain
unobstructed. District witnesses stand on open discovery approaches, with no
enemy spawning within15 units. This does not make districts safe from pursuers.

Evidence:30 client checks across witness, camp geometry and canonical admin
colliders passed2.499s; Dark Realm/witness/admin Go checks passed1.431s. Scoped
lint/diff passed. The native presentation check passed8.7s after the canvas trim
and phone close-approach framing changes; desktop camp and phone Maelin images
were inspected. These are rendered fixtures, not physical-phone acceptance.
The connected route also clicks Maelin and checks her read-only, spoiler-gated
conversation before accepting Ilyra's quest; the passing receipt is below.

The extended connected run `darkexp0921c` (`40671025`) passed Maelin's physical
conversation, Ilyra acceptance, all three actual discoveries, Recall and guide
re-entry. Manual completion then failed. Investigation found a real transition
bug: `EnterDarkRealm` clears the server movement context, but its handler had not
published that reset. After Recall, client movement still used the old context,
so the server rejected the apparent approach to Ilyra. Entry now publishes the
authoritative context before the scene transition, matching other scene paths.
The dispatch regression checks reset delivery, rejects departed-town packets,
and accepts movement under the new context after the normal scene grace. The
completed/reconnected reward route was subsequently verified as described below.

### Connected task completion and requested pause — September22

Recovered the completed `darkexp0921d` result at source
`ed88ce6c6bceca7c9fd02ce7ec2e2d45b45ac5e5` from the local Playwright report.
The sole test, `dark-realm-gameplay.spec.js`, passed without retries or errors:
start2026-09-21T04:52:24.526Z, test duration79.994s, report duration81.988s.
Its final stdout receipt confirms shared entry, all three actual discoveries,
manual camp reward, saved reconnect and Recall. Assertions also cover Maelin's
read-only conversation, Ilyra surviving the periodic cleanup, no automatic
completion, the full investigation mask, Gold payout and level100 XP conversion
to Resonance. Prepared entry prerequisites are **not earned campaign evidence**.
The movement-context dispatch regression passed0.293s.

On September22, process/container inspection confirmed the isolated run had
ended and its disposable services were removed. No unchanged rerun was needed.
The user requested stopping at the next completed task or deployment: this
connected quest/re-entry task is complete locally, so pause here. No new release
was pushed; version1.9.29 remains the last verified live version. The overall
roadmap is not complete, and release preparation is deferred until resumed.

Still required: further district-scale composition where needed and
the coordinated100-hour/8–12-hour pacing pass. The first connected quest route
does not verify every later chapter. Authored counts alone do not
establish duration. The existing earned checkpoint19 and outstanding dungeon,
raid and finale acceptance remain unchanged. Next release needs cumulative patch
notes and synchronized version labels; the current live build remains1.9.29.

## September23 content-budget audit — duration still unproven

Reading the shipped-candidate JSON gives560 required hunt kills,120 personal
collection items and38 discoveries across24 chapters. With the production35%
drop chance and a guaranteed fifth eligible kill, expected kills per item are
`1 + .65 + .65^2 + .65^3 + .65^4 = 2.52563125`, not simply `1/.35`.
Sequential acceptance prevents collection kills from also satisfying the earlier
hunt. The expected eligible-kill budget for one character is therefore863.08.
This excludes incidental/ineligible enemies, missed pickups and another party
member needing additional personal drops; it is not a measured party duration.

| Assumed eligible kills/hour | Objective combat hours |
| --- | ---: |
|90|9.59|
|135|6.39|
|180|4.79|
|270|3.20|

These are sensitivity calculations, not chosen speed limits. Add discovery,
dialogue, travel/recovery, Nexus and finale time separately; do not double-count
travel already included in a mixed kills/hour estimate. In particular, reusing
the level-progression forecast's hypothetical3x field-party throughput would
leave only3.20 objective hours before those additions. Thus chapter count and a
solo90-kill/hour assumption do **not** demonstrate the requested8–12-hour
expedition for suitable parties. The opening connected receipt demonstrates
functionality only. Measure representative grouped field combat and the actual
Nexus/finale, then adjust meaningful content or balance if the combined estimate
misses the target. Do not multiply mandatory collection counts, slow combat or
add waits merely to force a clock target. No production tuning follows from this
unmeasured estimate alone.

## Existing seams and implementation order

1. Deliver approved boss-checkpoint town returns and the narrow movement-observer
   correction. Preserve earned encounter evidence; no unchanged long retries.
2. Coordinate level-band combat, quest, dungeon/raid and optional activity budgets.
   The old `experience_budget.go` derived kill XP from a percentage of the level
   requirement; the local tuning candidate now uses independent absolute anchors. Account
   for party sharing and25% Well Rested kill XP. Use representative play rates,
   not slow multi-browser formation time. Keep dailies optional; no forced waits,
   slower combat or daily-reset requirements to fill the100-hour target.
3. Build an explorable Dark Realm quest space and wizard-led chain using existing
   investigation, personal-item/icon, manual turn-in, party-credit and save systems.
   The existing `chronicle_14_resonance_gate` Umbral clear followed by
   `chronicle_15_dark_king` is insufficient for the requested8–12 hours.
4. Preserve levels, owned items/currencies, completed chapters, accepted reward
   promises, veteran raid access and15-minute logout expiry through migrations.
   Retain the existing100-level Umbral/weekly-raid gate on every new realm-entry,
   party, reconnect and administrative boundary path.
5. Verify representative progression bands and new content/reward boundaries,
   then integrate dungeon/raid progression. Separate authored budgets, estimated
   duration and measured playtime. Publish accurate per-version notes; existing
   31-chapter/old-curve receipts do not establish the new pacing target.

## Working narrative outline — draft, not shipped content

Ilyra establishes a resonant foothold beyond the portal. Maelin keeps the passage
stable, but the realm is built from histories Malachar stole. His promise of
protection becomes concrete: safety purchased with memory, choice and the right
to shape one's own future.

- **The Unwritten Shore:** establish the foothold, find separated expedition
  members and investigate a refuge whose inhabitants have forgotten their names.
- **The Tithe of Names:** recover personal records from ruined homes and a royal
  archive, confront memory collectors and hear why the first subjects accepted
  the king's bargain. Give witnesses personal, conflicting stakes.
- **The Stillwater Foundry:** trace machinery siphoning elemental resonance,
  dismantle its anchors and rescue memories being burned as fuel. Echoes connect
  these discoveries to the four realms' earlier investigations.
- **The City Without Tomorrow:** uncover the human cost of eternal peace and
  prepare the assault with Ilyra. Optional journals deepen the story without
  becoming mandatory reading-time gates or interchangeable collection padding.
- **The Umbral Nexus:** retain the Dissonant Herald, Null Architect and Eidolon
  Devourer: guardian of the bargain, builder of its machinery, consumer of its
  prisoners. Clearing the dungeon breaks the throne's defenses and earns raid access.
- **A Crown Unanswered:** Malachar explains his conquest; the four restored
  Eidolons intervene in four phases. Preserve manual rewards and expand the
  existing post-victory letter to acknowledge the realm's survivors.

Budget the entire Dark Realm block at8–12 hours of varied active exploration,
combat, discoveries, preparation, dungeon and raid. Allocate individual hours
after actual district objectives and play rates exist; this outline itself is
neither a measured pacing result nor evidence of completed content.
