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

## Alpha 1.0.49 package — local verification complete

Runtime **`b01d3c5`** is root-integrated, without changing root's version or
publishing it. The isolated package now aligns login/package/manifest/server/
container/deploy/QA defaults to **Alpha 1.0.49**, with a separate **only the
fragments you need** patch-note entry preserving all previous releases. Notes
explain personal world reservations, full bags, pity and the normal lifecycle
for fragments left in another instance; broader economy/story work is not
advertised as complete or live.

Package version/isolation/assets/landing contracts pass **250 / 2.957s**;
full client passes **217 suites / 3,212 tests / 201.597s**, lint passes.
Package Chronicle/quest/pickup race checks pass root **3.626s**, game **11.243s**.
The ordinary fresh Wizard collection route against this package passes **2.3m**:
twenty observed target deaths, no player deaths, **exactly eight** physical seeds
with no surplus, explicit manual consumption/reward and saved completion after
reconnect. Collection/handoff takes **95 seconds**, final level **17**; the
existing 8,000-XP/100-gold payout remains unchanged and requires broader tuning.
The level-30 dungeon stays correctly locked. Credential scan/cleanup pass.

The actual ready conversation is inspected and copied to
`/tmp/eidolon-release49-earned-collection-ready.png` before subsequent browser
runs can replace test-results. Logs `/tmp/eidolon-release49-client.log`,
`/tmp/eidolon-release49-quest-regression.log`, and
`/tmp/eidolon-release49-earned-collection.log`.

Final anonymous browser sweep passes **75 / 8.8m**, unchanged package c0a6910,
log `/tmp/eidolon-release49-anonymous-rerun.log`. The first sweep closes with
**74 / 75 passing in 10.1m**: one phone-build fixture cannot load modules before
its layout assertions. Its actual trace shows simultaneous local-script
`net::ERR_NETWORK_CHANGED` failures and is preserved at
`/tmp/eidolon-release49-network-change-trace.zip`; no assertion is weakened and
no source change is made for the successful full rerun. Both handles are closed.

Still required before publication: all earlier sequential release gates, its
own CI/deploy and exact live verification. This locally verified package may be
checkpointed/integrated, but must not jump ahead of releases 40–48. The separate
investigation branch retains its own earned evidence and is not part of this
package's active quest chain. This package does not close the broader balance
pass or full roadmap.
