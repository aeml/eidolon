# Chronicle investigations — shared content and recording foundation

Status: foundation implemented and locally tested; **not yet playable quests**.
This follows the [balance and story plan](2026-09-07-progression-balance-and-investigations.md)
and [authored narrative](2026-09-07-investigation-story-content.md).

## Expansion branch checkpoint — September 7

The following supersedes the foundation's 15-chapter status **on the isolated
investigation branch only**. Root and release branches still retain the working
15-chapter chain until the complete world interaction is ready. Do not merge or
publish this intermediate graph as a playable expansion: it offers investigations
whose world objects and network actions are not registered yet.

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
weakening manual turn-in. Final game rerun is active as **61937**, log
`/tmp/eidolon-investigations-expanded-game-final.log`; targeted repeats **48341**
also run. All earlier handles are closed. Do not call the full backend pass green
until this exact rerun is confirmed complete.

Still required: native site models and correct collision/reachability, network
inspect request/acknowledgement, real authoritative Fire combat integration,
reading UI and actual earned desktop/touch playthroughs of all eight chapters.
Fresh-opening/collection browser routes must also earn the added diary instead
of skipping it. Review connective dialogue and reward pacing in the actual game.

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
