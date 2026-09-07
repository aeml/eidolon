# Chronicle investigations — shared content and recording foundation

Status: graph and world interactions implemented in the isolated branch;
**earned gameplay verification incomplete; not released or merged to root**.
This follows the [balance and story plan](2026-09-07-progression-balance-and-investigations.md)
and [authored narrative](2026-09-07-investigation-story-content.md).

## Expansion branch checkpoint — September 7

The following supersedes the foundation's 15-chapter status **on the isolated
investigation branch only**. Root and release branches still retain the working
15-chapter chain until the complete world interaction is ready. Do not merge or
publish this intermediate graph as a playable expansion: it offers investigations
until world objects and network actions pass earned playthroughs.

Implemented in this branch:

- A 23-chapter graph: each realm's personal record → collection → linked evidence
  → full dungeon; then the existing four raids/Maelin Vigils, portal and Dark King.
  Original IDs and access checks stay intact.
- All 15 legacy milestones migrate without rewinding progress or revoking access.
  Missing investigations behind an accepted/completed classic milestone become
  unaccepted optional catch-up lore. They are never marked completed by migration.
  Fresh required investigations stay required across refreshes.
- Accepted collection counts, drop rules, reward XP/gold and paid receipts remain
  unchanged. Each new investigation takes 1/8 of its realm collection XP and
  1/4 of its gold; the collection keeps the remainder. Per-realm and total fresh
  story budgets are exactly unchanged. Veteran catch-up quests grant their small
  quoted rewards on manual completion; old rewards are not clawed back.
- Optional status survives snapshot/BSON/production mapping/protobuf. Ilyra's
  dialog keeps the required chapter primary and offers catch-up separately.
  Future saved offers cannot replace its current quest marker. Optional quests
  have independent tracking preferences; normal story tracking follows the chain.
- The journal displays 23 chapters, explains optional earlier lore, and includes
  individually recorded field evidence even before turn-in. Undiscovered evidence
  and investigation summaries are hidden until earned. Expanded pages, keyboard
  focus and scroll position survive updates.

Current evidence: **217 client suites / 3,207 tests / 76.604s**, lint, targeted
UI **18 / 1.451s**, and discovery/graph/migration/protocol race checks three times
(root **1.720s**, game **14.063s**). Full server root passes **11.770s** after its
collection fixture completes the required diary normally. The original full game
run fails **247.941s** on one other old fixture expecting collection immediately
after the first hunt; that assertion now expects the actual next diary without
weakening manual turn-in. Final game rerun **61937** passes **242.722s**, log
`/tmp/eidolon-investigations-expanded-game-final.log`; targeted repeats **48341**
pass **3.144s**. All these handles are closed; the expanded graph backend passes.

### World integration checkpoint

Latest verified additions (September 7): release-48 corrections are merged into
the isolated branch as **`93f0162`**, with **276 focused checks / 4.148s**.
The full earned Earth route passes **3.6m**: diary, eight physical Memory Seeds,
three scar discoveries, all explicit Ilyra turn-ins, saved handoff and the still
closed level-30 dungeon gate. Final level **17**, **16 observed target deaths**,
zero player deaths; collection/scar/handoff portion **138 seconds**, collection
reward **6,000 XP / 50 gold**. Log
`/tmp/eidolon-investigations-earned-earth-travel.log`. The first combined run
failed when roaming enemies covered its walking path; the shared ordinary jump
fallback is now permitted, without travel/quest/protection grants.

Phone USE previously selected only vendors and directly opened the shop. It now
retains nearby-loot priority and sends other nearby services/discoveries through
their normal click interaction, using actual interaction ranges. Dead players
cannot activate it. Readable/interactable props use a pointer cursor rather than
a combat crosshair. Focused checks pass **42 / 1.759s**; full client passes
**219 suites / 3,251 tests / 138.491s**, lint passes.

The extended phone route passes **1 / 1.3m** (test 1.2m): ordinary opening kills,
manual reward, diary acceptance, actual joystick travel/USE inspection, journal
at **390×844 and 844×390**, manual diary completion and saved rereading after
reconnect. Actual screenshots in its `test-results` directory are inspected.
Log `/tmp/eidolon-investigations-phone-town-route.log`. This uses the existing
explicit level-30 combat fixture; it is **not** fresh progression or physical-device
performance evidence. The first two attempts fail on a straight route through
the merchant stall, confirmed by position/nearby-entity diagnostics and an actual
phone screenshot. The successful route follows the open south side of the square;
no collision, teleport or runtime-position bypass is added. Credential scans and
disposable cleanup pass. All these owned handles are closed.

Still open: remaining Water/Fire/Air chapters, actual ordered Fire fight,
landscape diary touch-scroll to the final paragraph, all-realm placement review,
coordinated rewards/XP tuning and final combined backend/regression packaging.

Authenticated inspection dispatch sends personal quest state before its receipt,
including rereads. Actual Fire anchor death awards only eligible nearby party
members with the earlier ash evidence. A real `PerformAttack` test kills the
ordinary anchor and confirms two prepared members receive credit, with no quest
completion or quest payout. Three race repeats pass root **2.121s**, game
**1.799s**; further graph/network checks pass **1.912s / 7.472s**.

Normal move-to-interact requests inspection; an earned receipt opens the existing
journal only for the current character, scene, site and unexpired reading intent.
Delayed/unsolicited receipts cannot interrupt a new session. Next-investigation
summaries no longer broadcast before discovery. Mara's completion now connects
explicitly to Memory Seeds before examining the altered roots.

Fifteen native non-Actor landmarks cover four abandoned records and eleven
readable disturbances. Personal beacons reflect accepted, unrecorded evidence
and its prerequisites. Only actual ruined walls block walking; the foundation
and open approach stay clear. Chunk unload/reload owns geometry and colliders.
Request/model/lifecycle/journal checks pass **37 / 2.075s** after completing the
test canvas text-metrics stub. Hardware model gallery passes **1 / 2.7s**; its
actual PNG is inspected. This is art evidence, not world placement/playtesting.

World initialization now registers sites in this isolated branch. Fresh and
functional Earth routes must earn the diary/scar rather than skipping them.
The first fresh opening passes (level 5/no deaths), but diary travel fails to
reach 125,200. The helper now waits for the previous walk/camera to settle.
Rerun **66245** reaches the cottage but cannot hover its center. Diagnostic run
**71050** confirms three Skeletons overlap the foundation-center ray; the actual
approach screenshot shows the visible, reachable cottage and its book. The helper
now tries visible geometry on the actual prop, preserving hostile raycast priority.
Fourth run **65713** passes **1 / 1.2m**: ordinary level-one Wizard combat/travel,
acceptance, real prop click, server-confirmed journal, explicit Ilyra completion
and reconnect persistence. No credit, item, level or protection grants. First
opening grants 500 XP/100 gold (level 5); diary grants 1,000 XP/25 gold (level 8),
total automated route **71 seconds**. This is not a new-player timing estimate;
it reinforces that early rewards still require coordinated tuning.
Log `/tmp/eidolon-investigations-diary-visible-prop.log`. Actual approach and
earned-journal screenshots are inspected under its `test-results` directory.
Credential scan finds zero files to sanitize; disposable cleanup passes. All four
owned browser handles are closed. Earlier logs are retained, not passing runs.
Full client passes **219 suites / 3,238 tests / 163.896s**, lint passes.
Full server race **68729** passes (root **16.818s**, game **307.701s**), log
`/tmp/eidolon-investigations-landmarks-server.log`.

Still required: remaining earned desktop/touch playthroughs, every realm's actual terrain
and collision review, ordered Fire combat in-browser, rereading/reconnect,
connective dialogue and pacing review. Keep isolated. Integrate newer release
queue runtime ancestry before final expansion regression/release packaging.

## Historical foundation checkpoint

## Implemented

- Eight authored chapters, two per realm, compile into matching client/server
  catalogs. Sixteen individual discovery objects have stable IDs, proposed
  coordinates, directions, narrative text and ordered Fire prerequisites.
  `node scripts/generate-chronicle-investigations.mjs --check` detects divergence
  from the narrative and placement sources. Generated files must not be edited.
- Server discovery recording validates the real object, accepted investigation,
  living overworld character, authored location and five-unit inspection reach.
  Each personal discovery has its own saved bit; repeated clicks do not advance
  another objective or another player. Discovery does not grant gold/XP or
  automatically complete the quest.
- The Fire command anchor cannot be inspected for combat credit. Recording
  requires a defeated authoritative enemy and the earlier ash discovery; the
  released ember requires the anchor. The current test exercises defeated
  state, not a real combat playthrough or the death-pipeline integration.
- Individual discovery bits survive actual character snapshot → BSON → production
  quest mapper → daily refresh → protobuf. Metadata repair derives the count
  from valid bits instead of inventing discoveries from a saved total.
- Client recovered-lore selection uses those individual bits, not the first N
  entries or unaccepted quest counts. Ilyra's completion speech follows stable
  quest IDs, so inserting chapters cannot accidentally deliver a raid/finale
  speech for a different quest. New speeches retain authored paragraphs.

## Verification

Full client: **217 suites / 3,203 tests / 120.157s**. Full server race: root
**13.400s**, game **321.451s**, other packages pass. Logs:
`/tmp/eidolon-investigations-foundation-client.log` and
`/tmp/eidolon-investigations-foundation-server.log`.

The targeted discovery/save/protocol checks pass three race repetitions
(root **1.708s**, game **3.272s**); client content/conversation checks pass
**10 / 1.495s**. Lint initially finds one regex-style issue in the generator;
the equivalent `{2}` spelling fixes it and lint passes. Generated-content
verification is repeated after that formatting-only correction.

## Required before activation and release

The existing **15-chapter** quest catalog remains active. Site spawning is
deliberately not registered in world initialization, and recording is not exposed
as a network action or connected to enemy death. No player is offered these
investigations yet. Do not advertise this checkpoint as expanded playable story.

- Insert eight chapters around stable collection/dungeon IDs, expanding to 23.
  Define migration that preserves existing accepted contracts, completed gates
  and earned access; offer missed lore without marking it completed for players.
- Divide the realm reward budget among its collection and new investigations,
  rather than adding eight full-size payouts. Accepted old contracts must not
  lose their promised requirements or rewards. Coordinate XP with dungeon levels.
- Add network request/acknowledgement, authoritative combat credit, quest updates
  and readable inspection UI. Keep rewards exclusively at manual Ilyra turn-in.
- Render recognizable native world props, correct collisions and interaction
  prompts. Coordinates are checked only against broad realm bounds so far;
  actual terrain, hazards, line of sight and reachable routes remain unverified.
- Wire saved discoveries into the journal, with clear current directions and
  useful summaries that do not require reading a diary while enemies attack.
- Update chapter totals, main/optional story selection, markers and tracking.
  Preserve four full dungeon clears, then four full raids plus Maelin's defended
  repairs, before the portal and Dark King. A site click never repairs a crystal.
- Play and inspect all eight chapters on desktop and touch, including old saves,
  reconnect, manual rewards, Fire combat, journal rereading and full raid gates.

This checkpoint remains separate from the verified Alpha 1.0.48 release branch.
It is not a versioned release or evidence that the broader balance pass is done.
