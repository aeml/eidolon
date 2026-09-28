# Alpha 1.27 — finding your way through the expedition

Local work only. Keep InstanceAtlas, AtlasQuestMarkers, world-map.css, DarkRealmJourney tests,
atlas-interiors browser changes and this record OUT of the Air1.25 and raid1.26
publications. No server combat, reward, progression or save changes.

## Existing story and actual gaps

The deployed expedition already has four districts,24 chapters (12 investigations,
eight hunts and four collections),38 discoveries and six optional witnesses.
The inherited connected first-chapter receipt, level100/personal-repair admission,
camp recovery, local manual Ilyra claims and saved/veteran-contract behavior remain
in scope at their original proof boundaries. No new long campaign is justified
by this navigation change. The owner assigned actual8–12-hour expedition pacing
and roughly112-hour campaign validation to player testing; those are NOT measured
or accepted by this milestone.

The atlas previously exposed a generic camp destination, but no independently
searchable Ilyra projection, Maelin or Ren. Ilyra appeared only through a tracked
available/ready quest. District destinations described no connected return roads.
Hunt/collection markers had the right district bounds but did not explain the
district-local kill requirement, chance drops and physical pickup themselves.

## Changes

- Persistent camp destinations use canonical Ilyra coordinates from worldLocations
  and Maelin/Ren coordinates from the existing witness roster. No duplicate NPCs,
  new vendors, quest actions or rewards. Ilyra explains personal Complete Quest
  and Gold versus level-cap Resonance XP. The other two remain read-only voices.
- Camp copy identifies recovery INSIDE the lantern circle, not the entire180-unit
  camp floor. Recall/B and Escape-menu Return to Lanternhold are described, with
  return through the town portal or Guide. No invented clickable exit portal.
- District instructions follow the authored north/west/south/east circuit and
  retain explicit void/straight-line warnings. City copy distinguishes the Nexus
  field records from private dungeon admission at Lanternhold's Guide.
- Every one of the12 hunt/collection chapters names the appropriate enemy. Hunts
  state level100+ and the correct district; collections explain chance drops and
  physical pickup. Existing saved objective text stays visible. Completed counts
  switch to canonical Ilyra; completed quests lose active markers.
- Discovery masks, prerequisite reveals, optional catch-up lore, four unique quest
  item icons, count/drop/XP budgets, party credit and Nexus eligibility are unchanged.

Authoritative references: dark_realm.go for circuit/camp/NPCs/admission;
dark_realm_campaign.go for chapter objectives, level/district kills and enemies;
chronicle_world_drops.go for district-qualified physical loot; generated Chronicle
catalog from content/dark-realm-chronicle.json; QuestConversation for manual claims
and level-cap reward wording. This is not a replacement for authoritative actions.

## Evidence

72 focused journey/instance-atlas/quest-marker/Chronicle checks passed2.012s;
scoped lint and whitespace pass. Coverage includes all12 combat/collection chapters,
canonical camp positions without a quest, no snapshot mutation, missing/private
layout isolation, existing saved masks/prerequisites and ready/claimed transitions.

Two bounded real-Chrome UI cases passed12.3s at1280×800 and390×844: search each camp
person, inspect Ilyra's reward/manual-claim text, set the exact40012,40800 waypoint,
then inspect collection guidance and set the real shore district waypoint.
Captures at`/tmp/eidolon-127-dark-journey/`; portrait collection and desktop Ilyra
views inspected. Controls and text fit; actual map/waypoint selection works.
This is anonymous HTML/canvas evidence, not earned story completion, physical-phone
combat or an8–12-hour playtime receipt. No account grants or network quest actions.

The added390→844×390 rotation check initially passed8.3s but screenshot review
showed only a narrow map strip below the longer directions. Short landscape
phones now place the scrollable42%-width directions beside the map rather than
above it. Portrait and desktop rules are unchanged. The affected case passed
again7.9s with stricter bounds: map height>150px, width>300px, separate adjacent
panes, reachable waypoint action and visible Close. Refined screenshot inspected
at`/tmp/eidolon-127-dark-landscape-refined/`; map area is roughly twice as tall.
The original capture remains at`/tmp/eidolon-127-dark-landscape/` for comparison.
This shared atlas CSS change also benefits other mapped scenes on short landscape
phones; it does not change their destinations, projection, geometry or controls.

Final packaging: version/login/runtime defaults and cumulative notes are1.27.0.
All372 focused version/journey/atlas/Chronicle checks passed10.201s; full lint
and whitespace pass. No campaign/raid or already-passing scene replay.

Remaining: predecessor acceptance, publication, mandatory CI/live checks and exact public
verification. Human pacing, real-party feedback and final modern-art/actor approval
remain open. This work does not open closed beta or change open-alpha access.
