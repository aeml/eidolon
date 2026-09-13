# Eidolon content cadence

This is the operating cadence for the Resonant Age, not a promise of new
continents, currencies, or fixed-date releases. The in-game Help → Your Next
Adventure guide explains the same choices. The Chronicle is permanent; daily
attendance and casino wagering are not prerequisites for its completion.

## Existing playable rhythm

| Rhythm | Content and player-facing source | Authoritative implementation |
| --- | --- | --- |
| At the player's pace | Ilyra's Chronicle, realm dungeons and crystal raids; Journal and Dungeon Guide. Completed players can ask Ilyra, Mara and Selen about the unsigned letter. | `server/internal/game/quests.go`; `src/data/chronicleAftermath.js` |
| Every ten minutes | Earth → Water → Fire → Air public disturbances; World Map and nearby objective. One-minute warning, encounter expires at minute eight, success calms local hazards for five minutes. Ordinary combat rewards, no extra attendance/completion purse. | `server/internal/game/public_events.go` |
| Daily, midnight America/New_York | Optional blue-marker contracts. Journal displays the reset countdown; daylight saving changes apply. Does not reset story progress. | `server/internal/game/quests.go` |
| Weekly, Monday 00:00 UTC | Dark Realm personal cache; Dungeon Guide displays the saved claim status and next reset. Claimed players may still help friends. | `server/internal/database/raids.go`; `server/client_dispatch.go` |
| Calendar quarters, UTC | Arena seasons and guild dungeon rankings. Arena settlement archives the prior record, awards qualified Honor and resets seasonal rating/counters; retained Honor and character/story progress are not wiped. Settlement occurs on subsequent arena access, not through a new scheduled job. | `server/internal/arena/seasons.go`; `server/internal/database/pvp_seasons.go`; `server/internal/database/guild_leaderboard.go` |
| Player-organized | Group Finder and guild events let communities choose dungeon, raid and social evenings. Public casino games remain optional entertainment with disclosed wagers, not a progression task. | Existing social/guild and casino interfaces |

## Sustainable release cycle

- Between seasonal boundaries, prioritize reported progression blockers, economy
  exploits and usability failures. Ship scoped fixes with truthful patch notes;
  do not save critical repairs for a calendar date.
- Before each new quarter, review available reports: which activities players
  actually finish, queue/party friction, upgrade value and Gold sources/sinks.
  Missing measurements are unknowns, not permission to claim good balance.
- Choose a bounded seasonal refresh using existing content: encounter tuning,
  an optional lore conversation, build adjustments or a themed machine variant.
  Publish only what is delivered. Do not promise an additional continent, class,
  currency, attendance streak or mandatory daily grind as routine maintenance.
- Explain changed rules before they affect earned standings or spending. Keep
  existing season receipts/history, quest completions and wallet balances intact;
  apply ranking-rule changes at a clear boundary unless correcting an exploit.
- Check changed behavior and essential persistence/economy invariants. Reuse
  unaffected evidence; run the broad cross-feature acceptance pass once after
  the 1.10 feature set is complete, then repeat only affected paths for fixes.
- Deploy from the release branch with synchronized identities and cumulative
  patch notes; verify the actual live client/server release. Seasonal rollover
  already runs in existing server code and does not require a separate release,
  cron service or new reward framework.

VIP currency name and acquisition policy remain a user decision. This cadence
does not authorize inventing that economy or treating an unfunded VIP lounge as
finished content.
