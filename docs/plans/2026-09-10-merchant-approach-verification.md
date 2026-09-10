# Earned campaign merchant approach verification

QA-only work, not a game release. The fresh campaign and full roadmap remain
incomplete. No reward, progression, combat, collision or recovery rule changed.

## Observed failure

Fresh run84056 on ea6cdbb passed opening/diary, Watch40, Seeds8, Imp60 and three
scar investigations. At Orc37/50, level29, zero deaths, its merchant visit failed
the15-second IDLE/no-target/camera-settled predicate. Final position was
[23.655,0,199.79286313409136], full902HP/638MP, three free bag slots. This was
not the whole-test timeout or Orc phase budget. Retained PNG shows the player
obscured by the stall. The original observer did not retain state/target/camera,
so the evidence cannot identify which predicate remained false.

Archive `/tmp/eidolon-fresh-orc-phase-proof-A6Wgqj`; log
`/tmp/eidolon-fresh-phases-replay.log`. The wrapper's actual-credential artifact
scan passed and disposable services/ports were cleaned up. No final Orc reward,
handoff or level30 readiness acceptance may be inferred from this partial run.

## Bounded original-route diagnostic

72fa6b8 adds merchant approach before/after position, pending target, actor state,
camera and blocked-stop evidence on failure while preserving the original error
cause. It leaves the approach algorithm and15-second settle limit unchanged.
The dedicated native diagnostic uses a fresh disposable character, twelve normal
Recall/walk/shop-open/close visits, no grants or sales, and a fixed four-minute
test limit. It is not a campaign completion or inventory-conservation test.

Actual80980 PASS1/1.0m, all12visits, retries0 on clean72fa6b8, System Chrome
inside sg-render, Node24.18.0. Each settled around x20, z200, with no pending
target and the shop/bag visible. Original long-run failure was NOT reproduced.
Archive `/tmp/eidolon-merchant-original-proof-PyNrX6`; log
`/tmp/eidolon-merchant-approach-native.log`; actual credential scan passed,
exact API/Mongo/image and18560/18561/41960 listeners absent after cleanup.
Focused29275 PASS10tests/2suites1.198s plus lint/shell/diff checks.

## Correct the independently identifiable observation race

`moveByGroundClick` returns after displacement exceeds one metre, not after
arrival. The former merchant loop immediately calculated another relative
offset and projected it while both actor and camera could still be moving.
Near the merchant that can aim past the intended stop. Source proves the race;
it does not prove this is the sole cause of84056's failure.

The coordinator now settles before each offset read, verifies that snapshot is
still settled, and only accepts distance below4.5 from a stopped position. Same
12-unit maximum click, three-unit intended stand-off, eight-move bound, ordinary
Shift-click walk, no jump fallback, real merchant hover/click, visible shop/bag,
and unchanged individual sale/conservation checks. Each settle retains at most
15seconds; the entire approach gets one fixed45-second cap, never renewed.
Input/settle failures propagate with read-only diagnostics; no retry or teleport
is added. No claim of a production collision fix.

Focused54885 PASS19tests/3suites1.023s plus lint/diff checks. Coordinator tests
model early movement return, ordered settle/read/click, transient proximity,
one absolute deadline, eight failed approaches, invalid merchant positions and
original settle/input error propagation. Full8866 PASS288suites/4056tests141.599s
plus lint. Logs `/tmp/eidolon-merchant-settled-full-{client,lint}.log`.
Corrected native36179 PASS1/1.2m on clean1b5a81b, all12visits, retries0,
System Chrome/sg-render/Node24.18.0. Every visit stopped at x19.4802,z199.9884,
no pending target, camera settled, shop/bag visible and zero blocked stops. The
original diagnostic accumulated12blocked stops. This supports the approach
correction but is not proof of the original long-run failure's sole cause.
Archive `/tmp/eidolon-merchant-settled-proof-ijYfo8`; log
`/tmp/eidolon-merchant-settled-native.log`; actual-credential scan passed and
exact API/Mongo/image plus18560/18561/41960 listeners were absent after cleanup.
Neither passing route emitted a success screenshot; no inspected rendered
shop/art quality claim.

Subsequent fresh13998 on clean/frozencb348ef PASSED the complete eight-phase
Earth story-readiness route in52.7m, retries0, with five actual earned merchant
visits, includinglevel29, and two stash visits. All50Orcs/manual reward/save,
handoff and strictstory-onlylevel30 readiness passed; finallevel31. See
[earned readiness proof](2026-09-10-earned-earth-readiness-proof.md) for exact
receipts, archive, cleanup and boundaries. This supports the correction without
claiming the original failure's sole cause, production deployment, a dungeon
clear, all-class/group balance or whole-roadmap completion.
