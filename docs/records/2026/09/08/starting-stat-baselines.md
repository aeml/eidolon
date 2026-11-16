# Starting-stat baseline discrepancy

Read-only finding during the September8 release45 continuation. No stat changes
or migration have been implemented. This belongs to the first-hour/class balance
gate, not proof that one baseline should automatically replace another.

There are three separate profiles in current source:

| Profile | Starting attributes | Actual owner |
| --- | --- | --- |
| New online character | Strength, Dexterity, Intelligence, Wisdom and Vitality all10, for every class | New-character branch in server/client_dispatch.go |
| Prepared /level fixture | All10 plus10 in the class primary: Fighter Strength, Rogue Dexterity, Wizard Intelligence, Cleric Wisdom | canonicalBaseStatsForClass in server/internal/game/progression.go, used by SetPlayerLevel |
| Offline class | Different per-class distributions: Fighter10/4/2/3/8; Rogue4/10/5/3/5; Wizard2/4/10/6/3; Cleric5/3/4/10/6 (Strength/Dexterity/Intelligence/Wisdom/Vitality) | CONSTANTS.ENTITIES and Actor constructor |

The private helper's name "canonical" is not evidence that production character
creation uses it. Existing saved online attributes are loaded as stored; /level
rebuilds a prepared fixture instead. Do not use that command as an earned-play
comparison or overwrite existing player investments to make these profiles agree.

At online Wizard level1, the actual10Intelligence provides100maximum mana,
40raw Fireball damage and2basic damage after recalculation. The prepared level1
profile instead provides200mana,60raw Fireball damage and5basic damage. Both
use30mana per Fireball and0.01-per-stat passive recovery. This materially affects
the first expedition even though the difference is smaller at level100.

The real fresh route already observes the online baseline (100HP, basic damage2),
not the prepared profile. Its uninterrupted diary failure therefore remains
valid for that route. Catalog/payout-only tests which use the prepared helper
still establish their asserted reward arithmetic, not starter combat pacing.

Follow-up: explicitly choose one intended new-character class profile and define
offline parity and existing-save treatment before any balancing change; measure
earned all-class play from real creation and ordinary level-ups. Keep prepared
functional dungeon tests distinct. Online attribute allocation is also distinct
from offline allocation: current server source has no StatPoints field, while
Actor has offline stat points; UIManagerCharacter hides allocation for multiplayer.
Do not attribute fresh online losses to unspent offline-only attribute points.
