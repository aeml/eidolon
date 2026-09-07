# Personal fragment world-drop budget

Status: implemented and locally race-tested; not published. This is one slice
of the progression/economy pass, not final XP/gold/equipment balance.

The production asynchronous death pipeline can generate a new personal quest
fragment on every eligible kill while earlier fragments wait on the ground.
With seven of eight already collected, twenty guaranteed guardian kills produce
twenty world fragments per eligible player. The reproduced solo/two-player test
fails **0.593s** before the correction. Its initial marker counted only three
equipment types; that test-fixture mistake is corrected to include neck/gloves
before recording the real twenty-fragment failure.

Budget checking, rolling and insertion now share one world-lock transaction,
with the player lock nested in the established world → player order. The actual
owned quest-item stacks still in the world reserve the missing objective slots.
Other players' items, other quest targets and ordinary items with the same name
do not reserve them. Covered objectives do not consume or advance saved pity.
Recipients who have left the captured encounter instance are revalidated before
any roll. Existing levels, rewards, owned items and accepted contract terms are
unchanged; manual pickup and Ilyra completion remain required.

There is no saved reservation counter: pickup, actual despawn, instance cleanup
and server restart naturally release world reservations. Drops still present in
another instance remain reserved until collected or removed under the existing
loot lifecycle (normally one minute); changing instance cannot manufacture
surplus fragments. Full bags retain their real drops and receive no false credit.

The actual death-pipeline regression passes three times **3.576s** after the fix.
Collection/lifecycle checks pass three race repetitions **8.929s**, covering
personal ownership, unrelated items, full bags, pity retention, despawn/replacement,
real pickup and scene-change rejection. Full server race passes root **12.795s**,
game **302.674s**, other packages green. Logs:

- `/tmp/eidolon-quest-world-budget-before.log`
- `/tmp/eidolon-quest-world-budget-after.log`
- `/tmp/eidolon-quest-world-budget-lifecycle.log`
- `/tmp/eidolon-quest-world-budget-server.log`

A 10,000-entity synthetic world benchmark measures **0.240–0.255 ms** per eligible
roll/publication across three runs, log `/tmp/eidolon-quest-world-budget-benchmark.log`.
This measures a single source operation, not whole-server concurrency capacity.
The world scan is skipped for characters without a relevant accepted collection.

Still required before release: version/patch-note packaging, final package checks
and the ordinary fresh collection route against this exact implementation. The
separate investigation branch's earned route does not validate this drop fix.
