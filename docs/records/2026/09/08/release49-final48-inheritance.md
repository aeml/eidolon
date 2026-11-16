# Release49 on the completed48/47 baseline

Isolated branch release/49-with-final48 starts from retained49/2f03507 and
merges48/08e2071 without conflicts at7a6c8a7b5825ec02af5d22596d904a0b18d0e436.
It retains49's personal fragment budget, distinct patch notes and version
defaults, plus48 Forge history and47 combat, pursuit, PvP scene and CI changes.
The inactive investigation support is not an activated31-chapter campaign.
The diff in the workflow/QA driver from48 is version strings only. The earned
collection assertion remains exactly the accepted number, not a lower bound.

On frozen7a6c8a7, prepare/lint58358 passed. Focused race76279 covers Chronicle,
quests, pickup, regeneration and Forge: root2.344s/game14.309s, normal exit0.
Full79297 client passed231suites/3323tests/151.745s; full91979 Go passed root
3.396s/database0.016s/game85.457s and all packages. Both normal exit0.
Logs: `/tmp/eidolon-release49-final48-{client,server,race}.log`.

Actual51936 fresh Wizard opening/collection passed1/5.9m, test5.8m, explicit
QA_SCRIPT_EXIT=0 and normal exit0. Opening manual turn-in took42seconds.
Collection/handoff took307seconds:14 observed target deaths, exactly8 physical
seeds, one player death. Ordinary respawn retained mana11/160, not a refill.
The death followed repeated defensive retreat from starter Skeletons into a
level30 DemonOrc group around227/393; retain this in the pacing evidence.
No changes to death bounds, resources, rewards or required items were made.

The inspected ready conversation shows8/8 and an explicit Complete Quest button,
100gold/8000XP. Normal claim consumes the fragments, grants once, and survives
reconnect. The level17 handoff correctly keeps the level30 dungeon locked.
This closes functional budget/turn-in/save evidence, not the known first-hour
level gap, reward balance, retreat strategy, full campaign or phone sign-off.
Credential scan sanitized0 files; independent Docker query confirmed the exact
release49-final48 containers were gone after normal cleanup.
Log `/tmp/eidolon-release49-final48-gameplay.log`; inspected screenshot archived
at `/tmp/eidolon-release49-carried-evidence-SXCsA6/earned-collection-ready.png`.

Not pushed/live. Keep46's final live QA and each sequential47→48→49 CI/deploy
gate. The separately carried50 candidate must inherit this closure afterward;
later releases must retain the same runtime ancestry and patch history.
