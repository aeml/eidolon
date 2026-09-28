# Alpha 1.31 — four-class combat review

Versioned local 1.31 candidate; 1.30 is published with CI pending. No1.31
deployment or claim of measured human class balance. The release record owns
current delivery status; historical preparation notes below retain their scope.

## Preserved contracts

Class identity comes from normal gear and earned training: Fighter Strength,
Rogue Dexterity, Wizard Intelligence, Cleric Wisdom. No early-level stat
multiplier. Passive recovery stays0.01 per relevant stat; safe zones provide
10%/second recovery and bank Well Rested. Town recovery and existing checkpoint
returns remain intentional. Owner pacing/real-party feedback stays deferred.

The existing regional skill matrix proves boss contact and instance isolation,
not class balance: its equal50-stat prepared actors are unsuitable as a gear
comparison. Existing Shield Slam already gives2× damage threat, and Guardian
Roar has impact protection, existing boss-taunt set restrictions and a one-time
highest-threat-plus10% adjustment. Do not accidentally recreate those features
or claim the buff's duration forces boss attention throughout that interval.

## New bounded role/resource observation

`TestPreparedFourClassRoleResourceBudgets` uses actual progression stats and
normal generated Uncommon/Rare role affixes,14 equipped slots, no potency,
talents, temporary buffs or runes. At30/60/70/100 it casts Shield Slam, Piercing
Throw, Fireball and Healing Light through PerformAbility, advances emitted
projectiles to actual impact, and observes healing on an injured Fighter.
Passed all four bands in0.298s. These are prepared open-world targets with no
armor or incoming attacks, not dungeon difficulty or an earned drop-rate sample.

| Class | Level30: actual amount / mana cost | Level100: actual amount / mana cost | Level30 /100 full-bar casts |
| --- | --- | --- | --- |
| Fighter: Shield Slam |337 /25 |1092 /25 |23 /68 |
| Rogue: Piercing Throw |235 /15 |727 /15 |38 /114 |
| Wizard: Fireball |324 /30 |996 /30 |55 /179 |
| Cleric: Healing Light |471 healing /25 |1455 healing /25 |23 /68 |

Role armor at30 is34/19/12/12 and at100 is97/60/29/29 respectively. Fighter
Shield Slam threat is twice observed damage. Healing restores real missing HP.
Wizard's Intelligence gear supplies the largest mana pool; Cleric's Wisdom
gear supports faster passive mana recovery. At30, empty-to-one-cast takes
64.1/38.5/76.9/17.0seconds, respectively: field recovery is deliberately slow.
Full-bar counts exclude concurrent regen and are not sustainable DPS estimates.

## Demonstrated support correction

Cursor-selected Healing Light/Divine Intervention could choose a disconnected
or zero-HP ally instead of a living nearby ally, despite explicit-target admission
already rejecting unavailable targets. Beacon could also heal unavailable
bystanders. Five focused repro cases failed before the fix. Friendly target
selection now requires positive health and a connected recipient; Beacon and
Mass Revival enforce that same availability at application. No new resurrection,
mana/cooldown change, heal-strength change or explicit-target redirection.

Offline cursor/Beacon had the matching zero-HP problem. All three new repros
failed before adding positive-health eligibility. Online replicas remain excluded.
Affected Go Cleric/support/healing/role checks passed7.991s; the expanded direct,
Beacon and Mass Revival regression passed0.277s. Corrected client command passed
all125checks across five support/healing/duration suites in1.82s; scoped lint passed.
An initial client command named nonexistent AbilityHealing.test.js; the actual
two suites passed63checks, but the invocation failed. Repeat uses discovered
existing test paths; do not report the mistaken invocation as all green.

## Remaining role review

### Bounded party pressure observation

The opt-in`TestPreparedFourRoleCombatWindow` passed12.212s. It builds a real
four-member party with the level30 role gear above, selects branchA through the
normal command, and observes12real seconds against the authored Normal
Rootbound Warden. Tank opens one second early, then uses Shield Slam, Whirlwind,
Iron Fortress and basic attacks; Rogue/Wizard use their baseline casts and
basics; Cleric heals the most injured living ally. Normal cooldowns, GCD, mana,
projectile flight, delayed impacts, boss AI and regeneration remain active.
No cooldown resets, resource refills or threat grants occur during the window.

Observed damage: Fighter3382, Rogue4870, Wizard3921. Cleric restored785HP;
received damage was260/358/182/182. All survived; ending mana349/294/1339/514.
These values include stationary exposure to the boss pattern, so received
damage is not a clean measure of single-target aggro retention. It confirms
actual role contribution under pressure, not a full clear, optimal rotations,
trained endgame balance or human5–10minute finale pacing. Exact totals are
observations, not brittle golden assertions. Opt-in prevents12seconds of
repeated waiting on every CI build.

No numeric balance change is justified by these short observations alone.
Retain existing prepared geared/legally trained endgame encounter receipts;
do not replay a raid merely for the new version. The demonstrated support
recipient bug is corrected; human sustained-role feedback remains open.

The bounded pressure observation above supplies actual training/basic-attack
role evidence alongside the level-band resource checks. It does not justify a
global buff or nerf. The demonstrated functional issue is fixed without new
combat VFX or heal-strength claims; support labels remain living-only. Preserve
earned encounter receipts; no campaign, raid soak or progression reset here.

Final packaging:429 focused support/version checks passed3.634s; scoped Go
recipient/role checks passed0.605s; full repository lint and whitespace passed.
The earlier12-second party window was not repeated for a version bump.
Publication, mandatory CI and exact live verification remain before acceptance.
