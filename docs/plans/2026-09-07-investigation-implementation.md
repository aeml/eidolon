# Chronicle investigations — shared content and recording foundation

Status: foundation implemented and locally tested; **not yet playable quests**.
This follows the [balance and story plan](2026-09-07-progression-balance-and-investigations.md)
and [authored narrative](2026-09-07-investigation-story-content.md).

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
