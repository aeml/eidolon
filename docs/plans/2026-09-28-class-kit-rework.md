# Complete, playable class kits — expanded Alpha 1.33 scope

Owner decisions, September 28, 2026:

- Redesign combos for **single-branch builds**. Do not depend on a future
  mixed-specialization system or silently grant cross-branch skills.
- Every class and specialization needs a satisfying full kit. Wizard's two
  non-Pyromancer branches and all three Fighter branches need ability rework;
  Rogue and Cleric also receive the full-kit pass. Pyromancer is the current
  positive reference, not an excuse to skip its consistency review.

This expands 1.33 beyond respec prices and combo descriptions. Those corrections
alone cannot complete the milestone. Earlier 1.31 support fixes and 1.32 warning
work retain their narrower claims; they do not prove the redesigned kits done.
Implementation across all four classes and focused receipts are recorded in the
[build-choice preflight](2026-09-28-1-33-build-choice-preflight.md). The first
all-twelve-branch candidate is now accepted live as Alpha1.33.0 at3f07f6ed;
player feedback remains pending.

The subsequent [integrated review](2026-09-29-1-33-kit-integration.md) records
all twelve ordinary loops, pressure/party roles, 60 learned level/gear admission
checks and bounded rendered/UI inspection. Local exact-candidate regressions
are recorded in the [release record](2026-09-28-release1-33.md); CI and public
delivery verification passed. Subjective feel is not certified.

Pre-rework baseline audit: 9 of the 16 combo pairs span branches. Fighter C,
Rogue A/C, Wizard A/B and Cleric B have no reachable combo. The client catalog
was enumerated against its tree and the corresponding server branch list
inspected; fixtures that force both skills unlocked do not close this gap.
Wizard, Fighter, Rogue and Cleric catalog pairs have since been changed/checked
to fit learned branches. Cleric now has an initial healer pressure pulse,
within-branch protective/strike/guardian payoffs and Zeal guardian rearming. Catalog
eligibility does not itself prove each kit or offline consumer complete.

## Design contract

Each branch must have a repeatable combat loop, an intentional setup/payoff,
useful actions between major cooldowns, and a way to respond to danger through
movement, control, mitigation or recovery appropriate to its role. A support
branch must still function when questing alone; a damage branch must contribute
in a party without becoming a better tank/healer than dedicated support.
Full kit does not mean every branch gets identical healing, mobility or DPS.

Use the current shared starter plus four branch skills as the initial action
budget. Rework redundant/passive-feeling buttons into useful interactions;
do not solve poor feel only by raising damage or shortening every cooldown.
Avoid excessive buff maintenance, immobile downtime, unusable execute windows
and setup that depends on an ability the branch cannot learn. Keep deliberate
resource use and town recovery; do not restore excessive field regeneration.

The final implementation must include server effects, offline equivalents,
aim/target validation, input response, animation/VFX, hotbar/tooltip/status
feedback, talents, runes, combo hints and saved-character compatibility.
Renaming a tooltip or adding a test-only effect is not a completed rework.

## Branch direction and delivery order

Directions below guide design; they are not claims of implemented mechanics or
final numerical balance. Preserve established class/stat identities.

| Order | Branch | Intended full-kit experience |
| --- | --- | --- |
| 1 | Wizard B — precision caster | A readable setup into accurate burst, useful ranged filler, a payoff for good aim and a defensive response. Scorch Beam, missiles, focus and lance must interact rather than feel like unrelated single-target damage buttons. |
| 1 | Wizard C — control mage | Reposition, group/control enemies, exploit that control, then reset safely. Gravity/temporal utility must support a satisfying damage loop; the shared Fireball cannot be the only engaging action between long utility cooldowns. Boss control immunity must not make the kit pointless. |
| 1 | Wizard A — Pyromancer | Retain the enjoyable area-pressure loop. Review cast responsiveness, hazards and single-branch combos without flattening the spec into the other two. |
| 2 | Fighter A — shield tank | Active blocks/protection windows, reliable threat and satisfying shield/counterattack payoffs. Defense must involve decisions rather than only refreshing long buffs. |
| 2 | Fighter B — control tank | Engage, gather/disrupt and cleave, with deliberate movement and a response to pressure. Control-immune bosses still leave meaningful attacks and defensive value. |
| 2 | Fighter C — offensive tank | Build pressure and spend it on heavy attacks, with a clear survival tradeoff. The kit must function at ordinary health, not require remaining below 30% HP to enjoy its defining action. |
| 3 | Rogue A — assassin | Accessible positioning/mark setup into a finisher, reliable follow-up and an escape/avoidance answer within this branch. No dependency on Utility's cloak or poison. |
| 3 | Rogue B — throwing specialist | A mobile ranged blade loop with distinct line, spread and burst uses. Bleed and volley payoffs should change choices rather than duplicate the starter attack. |
| 3 | Rogue C — trickster | Traps, poison and concealment produce an active solo/party damage-and-control loop. Not four utility buttons that leave all killing to basic attacks. |
| 4 | Cleric A — healer | Responsive single-target/area triage, meaningful cleanse/protection, and sufficient solo offense. Living-only healing and explicit death/revival rules stay clear. |
| 4 | Cleric B — battle cleric | Close-range holy strikes, ground/guardian pressure and a summon payoff, with readable sustain and positioning decisions. |
| 4 | Cleric C — support | Blessings and enemy debuffs lead into active holy payoffs. Buff upkeep cannot be the entire rotation; solo targets and party bosses both have useful interactions. |

## Combos and compatibility

- Rebuild the catalog around the final branch kits, including the shared
  starter where appropriate. Every branch needs a reachable, useful combo;
  avoid preserving four entries per class merely to satisfy an old count.
- Check the actual server branch unlock list, level requirements and mana/GCD/
  cooldown admission. A fixture with arbitrary unlocked skills is not evidence
  that a real build can perform a combo.
- A successful combo must visibly deliver its described payoff, be consumed
  once and not bypass existing cooldowns unless that is explicitly its design.
- Preserve accounts, items, levels, earned points and selected specializations.
  Prefer stable skill IDs for revised abilities. If a replacement cannot retain
  its ID, explicitly migrate hotbars, unlocks, mastery, talents/runes, loadouts
  and saved cooldown state; never leave paid choices attached to missing skills.
- No automatic branch selection, forced character reset or broad gear rescale.
  Publish meaningful changed skill behavior in each applicable patch note.

## Proportionate acceptance

For each branch, record its actual learned kit at relevant levels (10/20/30/40,
plus a representative endgame setup), its ordinary loop, pressure response and
boss/party use. Use class-appropriate Uncommon/Rare gear rather than unattainable
test gear or cross-branch unlocks. Add bounded real-cast checks for changed
effects, combo eligibility/consumption, resource/cooldown behavior, enemy
immunity and friendly/hostile target boundaries. Inspect changed presentation
at gameplay scale and ensure aim/feedback works with the existing touch controls.

Reuse existing unchanged collision, persistence and encounter evidence; do not
repeat long campaign/raid/soak runs for every skill. Luna monitors deployments
and any authorized long encounter checks. Human feel remains a playtest result,
not something a damage spreadsheet or test count can certify. Publish the
implemented kit and known tuning limits for owner feedback before asserting
the whole game is balanced.

1.33 remains open until all twelve branches meet the implementation contract.
1.39 then incorporates measured cross-class balance/role outliers, 1.43 handles
the integrated VFX/animation finish, and 1.47 retains the deferred real-phone
session check. These later passes do not excuse nonfunctional kits in 1.33.
