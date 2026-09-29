# 1.33 integrated kit review

Local implementation review, September 29. Not a live-release receipt or a
claim that automated checks can establish enjoyable feel or final balance.
The full roadmap remains active; later item/Forge/economy WIP is separate.

## Learned kit and resource check

`TestAllLearnedClassKitsAtProgressionBreakpoints` passed all 60 combinations:
four classes × three branches × levels 10/20/30/40/100. It uses normal branch
selection and the existing prepared role-item generator: Uncommon/Rare armor,
weapon and accessories with Strength/Dexterity/Intelligence/Wisdom respectively.
No cross-branch unlock injection or mana refill between actions. Every learned
action is admitted at ordinary health with its canonical cost and cooldown.
Movement settles between actions; only GCD is advanced before the next distinct
skill. This checks access and one-bar expenditure, **not** elapsed fight pacing,
campaign progression, enemy AI difficulty, or sustainable DPS.

The first run assumed every action costs mana, incorrectly rejecting the two
existing free Fighter buffs. The corrected check uses canonical resolved costs
and checks exact deduction, including zero. No live economy was changed to make
the test pass. Final run passed in 1.768s.

## Combat-loop review

These are the implemented branch loops reviewed against skill handlers, not
an optimal rotation mandate. Basic attacks remain valid between cooldowns;
resource exhaustion still calls for town recovery. Early levels intentionally
gain the kit in stages rather than receiving all five skills at level 10.

| Branch | Ordinary loop and payoff | Danger response and party/boss use |
| --- | --- | --- |
| Wizard A | Fireball → all-around Flame Whip; Tornado → faster Cataclysm; aimed Meteor for a committed burst. | Whip controls susceptible packs. Ground placement rewards timing; immunity does not remove damage. Existing Pyromancer loop preserved. |
| Wizard B | Beam → five Missiles; Focus before a damaging spell; Lance for a deliberate line burst. | Beam slows while Focus supplies a brief non-stacking ward. Ranged precision damage remains useful on bosses. |
| Wizard C | Gather with Well → stronger Fireball; Warp rearms Well and Teleport for another setup. | Shield and Teleport provide distinct protection/reposition choices. Well's damage/Implosion remain useful on control-immune enemies; Warp helps the party without resetting allies' skills. |
| Fighter A | Charge/Whirlwind for packs; Fortress → refreshed stronger Shield Slam; Slam → longer Roar protection. | Fortress trades speed for mitigation; Slam threat and Roar protect allies. Boss threat does not pretend to override encounter targeting rules. |
| Fighter B | Grip a priority target, Sweeping cleave, Earthshaker → Charge; Juggernaut now moves before its landing shockwave. | Control creates space against packs; two charges give reposition choices. Grip's strike and threat work on bosses without pulling/rooting them. This branch does not inherit A's group reduction. |
| Fighter C | Edge supports weapon attacks, Shattering exposes armor, Executioner spends the opening; Edge → Rampage grants a ward. | Edge retains its defense penalty. Rampage works at normal HP, with a stronger low-health snapshot rather than a mandatory near-death gate. |
| Rogue A | Mark → critical Backstab, Lunge for position/bleed, Spiral for nearby pressure; Throw covers range. | Lunge/positioning and burst, not Utility's cloak. Boss immunity does not invalidate the marked hit. |
| Rogue B | Serrated coating; line Throw, surrounding Fan, aimed cone Storm; Fan → piercing Volley. | Coated Fan creates a brief spacing slow. Storm is directional, unlike Fan; Volley trades a longer cooldown for three shots. Bleed and direct damage remain useful on immune targets. |
| Rogue C | Poison → aimed double-impact Tripwire; poisoned attacks/Throw between traps; Cloak → Smoke rearms another trap. | Smoke weakens enemies; cloak/reposition and roots help escape. Bosses take trap damage without roots. Neither concealment nor utility must do all damage alone. |
| Cleric A | Guardians for solo offense, Healing Light for triage; Light → Embrace grants caster protection, Intervention → Light heals nearby living allies. | Wave cleanses allies and now gives a modest hostile damage/slow pulse. Embrace protects the caster through its combo, not a secretly invulnerable party. No resurrection claim. |
| Cleric B | Ground → double Radiant Strike; guardians/Boost sustain nearby pressure; Seraph supplies autonomous holy attacks. | Ground heals allies; rune and positioning choices support close-range play. Strike no longer needs an unavailable Support mark. Existing living/hostile summon rules retained. |
| Cleric C | Resolve protects, Zeal → immediately rearmed boosted Guardians; Mark amplifies focus damage and Trumpet opens an area burst window. | Zeal haste supports movement and party attacks. Trumpet still damages/weakens immune bosses without stunning them. Mark now validates offline hostile targets before paying. |

## Presentation and build clarity

Five bounded browser scenes use actual actors, casts, chunk updates and renderer
for Wizard B ward/burst, Fighter B landing, Fighter C ward, Rogue C trap placement
and Cleric C boosted guardians. No effect is toggled on solely for a screenshot.
These are **prepared offline component scenes**, not authenticated live combat.
Spaced simulation updates prevent all opener flashes overlapping artificially.
The final five-scene run passed in 12.0s. Screenshots are under
`/tmp/eidolon-133-kit-presentation-spaced/`; inspected the Wizard/Cleric final
views and the first run's landing/trap/ward views. Character, trap and boundary
locations are legible; this is not a full environment/art-quality verdict.

Phone portrait/landscape combo layouts passed for all four classes, including
Fighter's five cards. Inspected Fighter and Cleric portrait captures. The review
found missing specialization context: desktop and phone cards now show branch,
unlock level and learned/other-branch status. This is build eligibility, not a
promise that a skill is off cooldown. Final combined browser run with this UI
passed six tests in 23.5s; updated scenes above were subsequently spaced.

Juggernaut's input range still advertised the old 28 units despite the new
10-unit movement cap. Client metadata now matches the cap; an actual
AbilityController range test guards the corrected targeting value.

## Remaining release work

Package only 1.33 changes, finish the exact-candidate combined regressions and
compatibility review, update login/package/backend/cumulative notes, then push,
use Luna for CI monitoring and independently verify the exact live identity.
Do not repeat long campaign/raid tests to measure a tooltip or combo card.
Player preference and numerical role tuning remain explicit playtest inputs;
1.39 balance and 1.43 integrated VFX polish retain their separate roadmap scope.
