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

The combined branch merges the verified portal-pointer QA ancestry at **144aac1**
without changing investigation runtime. Latest phone route **49124 SUCCESS /
one test / 50.3s** (test 48.9s): three ordinary touch-combat kills, explicit
landscape Ilyra reward/reply, real joystick travel to Mara, USE inspection, actual
swipes to the diary ending in both orientations, manual completion and saved
rereading. The existing level-30 fixture remains functional QA, not fresh pacing.
Both earned phone images are inspected and preserved in
`/tmp/eidolon-phone-combined-proof-YTqlQw/`; log
`/tmp/eidolon-investigations-phone-combined.log`, credential scan/cleanup pass.
This closes the latest combined first-diary touch regression only; the other
seven chapters' touch playthroughs and physical-phone verification remain open.
No owned browser remains active.

Air run **59545** against **fa9feaa** closes **SUCCESS / one test / 5.1m** (test
5.0m). Ordinary travel and actual crowd combat reach Selen's journal and all
three horizon markers; seven/eight engaged pursuers before the journal/updraft
are target observations, not audited kill counts. Both optional chapters receive
explicit manual catch-up replies/rewards, survive reconnect with masks 1/7, and
all four saved records are reopened and checked against the complete authored
text. Old Air dungeon remains completed; the first raid stays uncompleted.
Actual observatory, trapped-updraft and final earned journal images are inspected
and preserved in `/tmp/eidolon-air-earned-proof-U6GbWV/`. Log:
`/tmp/eidolon-investigations-air-earned.log`; credential scan/cleanup pass. All
four realms now have earned investigation evidence, on the explicitly recorded
source checkpoints. Water/Fire/Air use prepared returning-character fixtures;
this does not establish a complete fresh 23-chapter campaign, new XP pacing,
physical-phone usability or a released expansion.

Fire's bounded encounter run **3159** against **24d51e5** closes **SUCCESS / one
test / 4.4m** (test 4.3m). Ordinary combat clears seven pursuers before cold ash;
the later anchor fight records its actual death and mask **1 → 3**, with ember
still unrecorded. Click targets include the anchor (nine) and two covering Djinn
(twenty each); no discovery or kill credit is injected. The released ember is
then inspected normally, followed by manual catch-up replies/rewards, reconnect,
and full earned journal rereading. Credential scan and isolated cleanup pass.
Actual anchor combat, released hearth/sprout model and earned-record screenshots
are visually inspected and preserved in `/tmp/eidolon-fire-earned-proof-5ElOA2/`.
Log: `/tmp/eidolon-investigations-fire-bounded-encounter.log`. This demonstrates
ordered Fire functionality with the explicit level-100 common-staff veteran
fixture and available control skills, not fresh leveling or comfortable average
player difficulty. Air and broader balance verification remain open.

Latest story/model source **0036656** passes full client **219 / 3,279 / 174.009s**
and lint, plus full server race root **22.755s**, game **455.511s** (86062/1610
closed). Logs `/tmp/eidolon-investigations-catchup-client.log` and
`/tmp/eidolon-investigations-catchup-server.log`. Fire **26226** closes **FAIL /
8.9m**: Hessa and cold ash are genuinely earned; the actual bound-ember image is
inspected and preserved `/tmp/eidolon-fire-bound-ember.png`. The character
survives with full **2,575 HP**, and the counters prove **120 accepted Fireballs,
six Gravity Wells and five Shields**, with zero rejected casts in those counters.
No claim that Fireball failed follows from earlier uninstrumented deaths.

The anchor objective times out because the driver kites to **(-1313.9, 206.7)**
while the slower anchor returns to **(-1199.3, 145.0)** with **1,884 HP**. Mask
remains **1**, no anchor death is observed, and recorded click targets are ten
unrelated Djinn, not the anchor. This is target drift, not an unavailable reward
or completed fight. Failure image is preserved `/tmp/eidolon-fire-anchor-drift.png`;
scan/cleanup pass. The next test bounds only its ordinary retreat choices to a
32-unit encounter radius, including alternate sidesteps, so it stays with the
objective instead of recruiting new crowds across the realm. Dungeon collision
planning and existing unbounded fresh-hunt behavior remain unchanged. All **30
control tests / 0.465s** and lint/diff checks pass. Runtime enemy behavior, player
stats, damage, rewards and kill-credit checks are unchanged. Actual ordered Fire
completion and Air remain unverified.

Combined Alpha 1.0.50 ancestry **170c53f** passes full client **219 / 3,258 /
173.048s** and lint; full server race passes root **24.250s**, game **416.594s**
and remaining packages (30280/19540 closed). Logs
`/tmp/eidolon-investigations-50-client.log` and
`/tmp/eidolon-investigations-50-server.log`. Its Fire route **53097** fails **4.2m**
before cold ash: the unarmored common-staff returning fixture dies with nine
actual hostiles nearby, only four recorded retreats and one shield. This is
not ordered-anchor completion or comfortable field-pacing evidence. Prior **1309**
earned cold ash after engaging fourteen pursuers, then died fighting the anchor;
its inspected screenshot is preserved `/tmp/eidolon-fire-earned-cold-ash.png`.
All failed runs pass credential scanning and cleanup. No retries are counted as
passes and the current encounter-density/ordinary preparation question stays open.

The next prepared fixture can use its actually unlocked **Gravity Well** hotbar
against a close cluster, alongside normal Fireball, Arcane Shield and jump/kiting.
It selects the available key and pays ordinary mana/cooldowns, with no granted
damage, talents, gear or immunity. Existing fresh-hunt baselines keep their
shield/retreat-only behavior. Read-only counters now record accepted/rejected
Fireballs and wells as well as shields, so attempted inputs cannot be confused
with successful abilities. Twelve strategy cases cover availability, cooldown,
mana, hotbar, range and real clustering. This is better use of the prepared
character's existing control kit, not a claim that enemy density is balanced.

New source-authored retrospective acceptance and completion replies cover all
eight optional investigations, avoiding instructions to repeat already-earned
dungeon/raid progress. The server supplies those descriptions on initial
migration and refresh; client conversations and manual completion use the same
generated source. Fresh mandatory replies remain separate. Fire's required
completion now correctly says Ilyra holds the ore already entrusted to her.
Before routing fixes, all eight optional client cases fail (**1.761s**) and the
server metadata regression fails (**0.034s**). Afterward client conversation/
content tests pass **24 / 1.487s**; discovery/expansion/catch-up server tests pass
three race repetitions **6.302s**. Objectives, rewards, masks and access do not
change. Logs `/tmp/eidolon-catchup-client-before.log`,
`/tmp/eidolon-catchup-client-after.log`, `/tmp/eidolon-catchup-server-before.log`,
`/tmp/eidolon-catchup-server-after.log`.

The ember has player-specific native bound/released meshes. The bound ember's
shackles give way to a hearth's embers and a sprout only after the server records
the anchor evidence; a count alone cannot free it. Another player's view stays
bound and the completed mask restores the released view after reload. The normal
inspection beacon still requires the prerequisite and hides after recording.
Model, conversation, content and control tests pass **81 / 2.386s**, lint passing,
before the final small hearth-coal visual adjustment and browser assertions.
The prepared Fire browser now checks both visual states and actual manual
catch-up speeches. Full combined/browser verification of these latest changes
remains open; do not publish this isolated graph as a verified expansion.

Returning-story continuity: Ilyra's greeting now follows completed stable IDs for
all four repairs, portal opening and the Dark King's defeat. Optional earlier
discoveries no longer make her announce that already-restored crystals still
need healing. An empty quest response no longer declares victory; objective
counts without manual completion do not switch the greeting. Four new UI cases
reproduce the old contradictions (**4 failed / 9 passed / 1.427s**), then all
**13 pass / 1.447s**. This changes presentation only, not progression or rewards.
Optional chapters' historical acceptance/completion instructions still need a
full continuity review; the greeting fix alone does not complete that review.

September 7 Fire follow-up: realm routes now share
`tests/e2e/chronicle-realm-investigations.spec.js`, selected by guarded isolated
`water-investigations`, `fire-investigations` or `air-investigations` routes.
All use the same explicit old-save fixture and actual travel/skills/manual
turn-ins; new checks reopen each saved journal record after reconnect. Fire also
requires observed ordinary anchor death after the ash and before ember credit.
These extra checks are prepared, **not yet passing gameplay evidence**.

Fire run **35656 / 3.7m** fails after earning Hessa's ledger: death near cold ash.
The first driver excluded the anchor from ordinary crowd combat before ash;
this artificial restriction is removed. Real early anchor kills still grant no
discovery, and the test must await normal respawn and another real death after
recording ash. Rerun **48744 / 3.6m** fails differently: player alive at
**2,071/2,575 HP**, but all projected retreat clicks are covered by enemies and
the helper disallows jumping. Diagnostic and actual screenshot confirm no move
was attempted. Screenshot is inspected and saved as
`/tmp/eidolon-fire-covered-retreat.png`; logs
`/tmp/eidolon-investigations-fire-earned.log` and
`/tmp/eidolon-investigations-fire-normal-combat.log`. Credential scans/cleanup pass.
Prepared correction permits normal Ctrl-click jump retreats only in this realm
route (other earned hunt baselines keep walking-only defaults), reads actual
actor `stats.hp` for death/respawn, and captures failures. Runtime difficulty and
quest checks are unchanged. Fire ordered combat and Air remain open.

September 7 Water follow-up: the two Water investigations pass actual desktop
play **1 / 6.6m**, handle **6729** closed, log
`/tmp/eidolon-investigations-water-defensive-route.log`. This is an explicitly
seeded returning-character save through the nine old dungeon milestones, not
earned leveling or raid credit. Migration leaves both new Water chapters
unaccepted and optional. The player accepts each at Ilyra, travels through the
real north passage, inspects the flood shelter, both pools and mooring bell,
returns for explicit rewards, then reconnects with masks **1 / 7**, completed
contracts, gold and cap-only Resonance receipts. Prior dungeon completion stays
intact and the first raid is not completed by these discoveries. All actual
earned Water screenshots are inspected. Credential scan/cleanup pass.

First route 59985 fails **3.3m** after earning Dain's ledger: Mountain Trolls cover
the still pool's real click geometry. The next route 7160 uses ordinary attacks
to clear pursuers but dies. The successful route selects Control & Utility in
the real Skills UI and uses actual Arcane Shield/ordinary kiting, without damage,
invulnerability, despawn, teleport-to-site or discovery grants. It logs engaging
eight pursuers near the moving pool and twelve near the bell; these are engaged
target counts, not independently audited kill totals. Realm enemy pressure and
normal ten-second overworld respawns remain a fresh-player pacing concern, not
proof that a level-60 beginner can comfortably read here.

The initial fixture's arbitrary 100-damage staff is also corrected downward to
the actual common level-100 formula, **round(12 × (1 + 100 × .15) / 25) = 8**.
Canonical level-100 Wizard base stats are unchanged. The earlier 100-damage
fixture is not ordinary item-budget evidence. The prepared eight-damage route
is the passing one. Root still does not activate this expansion; Fire/Air's four
chapters, actual ordered Fire fight, all-realm touch/placement quality, fresh
progression and broader economy remain open. Water save masks/receipts are checked
after reconnect; explicit post-reconnect Water journal-opening remains to cover.

September 7, 21:30 follow-up: combined runtime 84abecf has backend race coverage
root **16.127s**, game **396.729s**. The combined invocation 90803 terminates with
SIGTERM/143 before reporting game results; its root package passes. No Go child
remains, and the subsequent verbose game-only invocation 83699 passes. Logs
`/tmp/eidolon-investigations-combined-server.log` and
`/tmp/eidolon-investigations-combined-game-rerun.log`. Cause of termination is
unknown; neither a timeout observation nor an assumed OOM is used as evidence.

The journal now restores expanded records before its saved scroll offset. A
later open entry otherwise loses reading position when the browser clamps the
offset against the collapsed content height. Modeled-layout red: **500 → 100**,
then focused **19 / 1.457s** pass. Actual browser red: **671 → 486 pixels** with
the old ordering; the same long-record fixture passes **1 / 4.2s** with the fix,
preserving position through three rebuilds. The first browser fixture omitted
an objective/target; the next short record passed with both implementations, so
neither proves the fix. The final test uses actual Earth/Water diary text and is
included in the anonymous suite. Logs
`/tmp/eidolon-investigations-reading-browser-before-long-record.log` and
`/tmp/eidolon-investigations-reading-browser-final.log`; preserved actual red
trace `/tmp/eidolon-reading-scroll-clamp-before-trace.zip`.

Full client with this runtime passes **219 suites / 3,252 tests / 145.889s**, lint
passes (`/tmp/eidolon-investigations-reading-client.log`). Actual earned phone
diary route **84495** closes successfully **1 / 48.8s** (test 47.4s): ordinary
joystick travel/USE, real touch scrolling until the final text line lies inside
the journal scrollport and is unobscured, explicit Ilyra completion and saved
rereading. Landscape starts with that ending outside the reading area, ensuring
the swipe is exercised. No programmatic scroll is used for this earned reading
check. Both actual images are inspected and preserved at
`/tmp/eidolon-earned-diary-reading-390.png` and
`/tmp/eidolon-earned-diary-reading-844.png`; log
`/tmp/eidolon-investigations-phone-reading-final.log`. Credential scan and
disposable cleanup pass. The explicit level-30 phone combat fixture remains,
so this is not fresh leveling or physical-device performance evidence. The QA
performance overlay is visible in captures; it is not claimed as production UI.

Landscape diary reading is now verified. Remaining Water/Fire/Air field routes,
ordered Fire combat, wider placement review and coordinated reward tuning stay
open; this graph is still not merged to root or released.

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
