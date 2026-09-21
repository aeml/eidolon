# Approved campaign pacing and Dark Realm expansion

September21 decision: approximately100 hours to level100, then8–12 hours of
Dark Realm quests/lore, including the dungeon leading to the Dark King raid.
Aim for roughly112 hours overall. Level100 is required before realm entry.
The finale remains5–10 minutes across four phases for five well-geared players.
This is required remaining1.10 work, not delivered1.9.29 content.

## Existing seams and implementation order

1. Deliver approved boss-checkpoint town returns and the narrow movement-observer
   correction. Preserve earned encounter evidence; no unchanged long retries.
2. Coordinate level-band combat, quest, dungeon/raid and optional activity budgets.
   `experience_budget.go` currently derives kill XP from a percentage of the level
   requirement: multiplying that curve alone also increases those rewards. Account
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
