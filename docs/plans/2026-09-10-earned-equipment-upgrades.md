# Earned equipment progression in campaign QA

Status: local QA implementation, full regression and prepared native swap/Forge
checks passed; earned dungeon-clear acceptance remains pending. The upgrade
driver changes no runtime, loot, stats, currency or bosses. Its native verification
also uncovered separately tested runtime icon/drop-target corrections, now merged
into primary; see [the retained native proof](2026-09-10-native-equipment-upgrade-verification.md).
No version or deployment change. This addresses a verification gap identified
in the [failed earned Verdant attempt](2026-09-10-earned-verdant-failure.md).

## Change and scope

The campaign no longer permanently keeps the first item equipped in each slot.
After existing empty-slot fills, class preparation and bag management compare
collected eligible equipment and drag improving items onto explicit equipment
slots. Bag management does this before selecting merchant sales or stash moves.
Dungeon entry repeats the comparison for drops acquired since the last training
stop. The existing training login check verifies resulting equipped identities;
the upgrade helper itself does not add a reconnect or regenerate resources.

The helper re-reads replicated items after each drag, requires the displaced
item back in the bag, conserves all owned items and their contents, preserves
unaffected equipment and level/XP/Gold, and rejects unconfirmed/lossy changes.
Each swap strictly increases a deterministic QA build score, under a fixed
action bound. Paired accessories can explicitly replace ring2 or trinket2.
It uses ordinary UI inputs, never inventory mutation, socket sends or grants.

## Explicit build assumption, not a balance model

The additive score is a baseline QA equipment preference, not a claim of optimal
builds, real DPS or game item value. Four primary-stat points correspond to one
basic damage in the server formula, so damage weighs4 and class primary1.
Vitality and defense weigh1; other strength/dexterity weigh0.25, intelligence/
wisdom0.5. Applicable class elemental/healing bonuses and common utility percentage
stats weigh1. Socketed gem stats count. Level and rarity labels do not add score.
These preferences can be revised from real gameplay evidence without changing
the game's mechanics or rewriting prior failure results.

Unknown stats, invalid data, set/unique mechanics are not modeled as ordinary
additive upgrades. Keep those items for a separately verified build decision;
do not silently strip effects to increase this score. Future-level equipment,
quest items, materials, gems, stacked gear and already worn identities are not
replacement candidates. Stash retrieval, Forge upgrades and optimized special
builds are not covered by this helper. They remain part of broader gear/gameplay
verification rather than being implied by a passing ordinary-upgrade test.

## Evidence and remaining gates

Full session41660 on clean54a4df69 exited0:291 suites,4102 tests,136.805s,
then passing lint. Logs `/tmp/eidolon-earned-upgrades-full-client.log` and
`/tmp/eidolon-earned-upgrades-full-lint.log`, Node24.18.0. Separate native fixture
branch44aaf011 adds a loopback-only, new-empty-account seed and actual full-bag
drags, paired-slot choice, exact item conservation and login verification. Its
prepared items are explicitly not earned campaign or dungeon evidence.

Focused session17443 exited0:87 tests in7 suites,1.381s and lint, Node24.18.0.
Logs `/tmp/eidolon-earned-upgrades-unit-integrated.log` and
`/tmp/eidolon-earned-upgrades-lint-integrated.log`.
Tests cover all four class preferences, real stat vs rarity selection, weaker
paired slots, gem contributions, ties, protected/invalid items, normal drag
wiring, conservation/rejection, bag-sale ordering and pre-dungeon integration.
The drag unit fixture is not a real browser or server test.

The first focused run32037 failed because Jest's environment lacks structuredClone.
The fixture now copies plain JSON state and negative cases also require an actual
attempted drag, so unrelated setup exceptions cannot satisfy them. Original
`/tmp/eidolon-earned-upgrades-unit.log` retained. Corrected77-test run94297 passed
before the final pre-dungeon integration and87-test run above.

Prepared native inventory drags, paired-slot swaps and saved ownership now pass
with retained artifacts (linked above). The integrated source also passed full
client293suites/4125tests and lint. Next replay earned
campaign/dungeon progression under unchanged combat/death/phase limits. Capture
the new full equipped-item and defense/skill diagnostics at entry/death. Do not
call the original boss failure fixed merely because the harness now upgrades.
