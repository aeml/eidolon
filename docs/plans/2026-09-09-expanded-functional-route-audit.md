# Expanded Earth functional-route coverage audit

September9. Static inspection of primary0691772 during its owned earned browser
run47584; no primary edits while that run is active. This is a required follow-up
for the expanded campaign, not a defect in the accepted58-based release59.

`tests/e2e/chronicle-earth-route.js:118` still runs opening → keeper's diary →
Seeds → returning scar → dungeon offer. `server/internal/game/chronicle_hunts.go`
inserts the authored hunt before each matching BeforeQuestID, while
`content/chronicle-hunts.json` requires:

1. Those Who Kept the Watch:40 level3+ Skeletons after diary, before Seeds.
2. Ink That Walks:60 level20+ Imps after Seeds, before returning scar.
3. The Borrowed Oath:50 level30+ Demon Orcs after the scar, before the Earth dungeon
   (catalog enemy subtype `DemonOrc`). Do not substitute another enemy.

The exact three chapter IDs are `chronicle_earth_kept_watch`,
`chronicle_earth_walking_ink`, and `chronicle_earth_borrowed_oath`. The complete
seven-chapter sequence is already asserted by `tests/storyReadinessPolicy.js`
and traversed by the independent fresh opening/collection route. The older
functional route is called by `chronicle-collection-gameplay.spec.js`; selecting
the Seeds offer immediately after diary is inconsistent with the expanded graph.
This is source evidence of missing coverage, not a reproduced browser failure.

## Required correction after the active primary run ends

- Keep functional level preparation explicitly labeled as such. It must not be
  counted as fresh-character pacing or earned-level evidence.
- Traverse every required chapter in authored order, with actual qualifying enemy
  kills, real naturally dropped Seeds and manual Ilyra acceptance/turn-ins. Reuse
  shared chapter metadata/driver behavior where appropriate rather than maintaining
  a second hand-written incomplete sequence. Do not grant quest credit or skip
  hunts to make the route pass.
- Target the hunt's actual enemy, minimum level and hunting realm. Existing
  `useEncounterQAWaypoint` selects the nearest live enemy to120,200, not a requested
  subtype/level, so calling it repeatedly is not sufficient for Imp/later hunts.
  Do not widen production quest eligibility to accommodate the QA shortcut.
- Preserve exact Seed consumption, immediately refreshed bag, no auto-completion,
  no premature raid access, and reconnect checks. If the longer functional flow
  exceeds its current600s test budget, measure the full route and split meaningful
  independently verified stages rather than silently omitting requirements.
- Add regression evidence for the ordered seven-chapter prefix, run the actual
  functional route, then verify full dungeon kill → manual turn-in → raid unlock.
  Keep the distinct unprepared/story-only class and group pacing gates open.

No runtime or test change made by this audit. The running primary test and
release59 pipeline remain untouched; this follow-up must not be forgotten when
expanded-story predeploy coverage is assembled.
