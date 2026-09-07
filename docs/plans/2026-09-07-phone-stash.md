# Alpha 1.0.34 — room for what you keep

Separate checkout `/tmp/eidolon-phone-stash-eqStpq`, branch `work/phone-stash`,
base `fb35139`, subsequently fast-forwarded to main `5b81112` to inherit the
clock-only CI repair and release receipts. Versioned as Alpha 1.0.34; not yet
merged or published. The main
earned dungeon browser source is unchanged while this prototype is developed.

The existing stash only offers right-click withdrawal and opens a companion bag
window. The phone candidate instead uses one stash surface with Bag/Stash tabs,
readable item rows, independent saved scroll positions, capacity counts and an
empty state. Tapping only inspects. Item details offer Store or Withdraw; unrelated
Equip/Drop actions stay outside this storage journey. Desktop storage stays on
the existing grid/right-click path. The mobile detail component still serves
ordinary bag/equipment actions outside this context.

Actions revalidate item identity and source index immediately before requesting
the existing server transfer. No local inventory mutation, capacity bypass or
quest-item deposit is added. Replaced slots invalidate detail actions; Back remains
usable and restores a refreshed row or the stash list if its old row vanished.
Server bag/stash updates refresh both the list and stale-detail guards.

Focused tests initially passed 22 cases. Full client validation then exposed four
initialization failures in two minimal-UI test suites: those fixtures host the
legacy stash grid outside the stash window. Initialization now uses that grid as
an insertion anchor only when it is actually a child; a new regression preserves
minimal-layout support. The failure is retained in
`/tmp/eidolon-phone-stash-client.log` (180 suites passed, 2 failed).
Corrected focused checks pass **116 tests**. Final full client verification passes
**182 suites / 2,527 tests in 115.052 seconds**, log
`/tmp/eidolon-phone-stash-client-corrected.log`; lint passes.

`tests/e2e/mobile-stash-layout.spec.js` is prepared for 360×800, 390×844,
844×390 and 568×320 with full Bag/Stash fixtures, native scrolling, readable
details, explicit callbacks, preserved scroll, quest protection and chat bounds.
After the earned full-dungeon session `53280` terminated successfully, all four
layouts **passed in 25.0 seconds**, session `33216` closed, log
`/tmp/eidolon-phone-stash-layout.log`. The portrait stash list and short-landscape
list/detail captures were visually inspected: long names wrap, rows scroll,
and the storage action remains reachable above the persistent chat entry. These
are seeded layout fixtures, not real-server transfer or physical-device proof.
The layout spec is now wired into normal anonymous smoke.

## Final candidate verification

The real-server phone inventory/storage route passes initially in 58.6 seconds.
The final versioned repeat passes in **1.4 minutes**, including portrait/landscape
ordinary town-stash interaction, explicit store/withdraw and fresh-login
persistence. The final repeat compares the **entire serialized item**, not just
its ID or selected stats. Existing combat-loot/equip/unequip/drop/recovery checks
also pass. Credential scans and exact disposable cleanup pass. Logs:
`/tmp/eidolon-phone-stash-{gameplay,final-gameplay}.log`.

Source inspection and a failing server regression exposed a UI-only Chronicle
quest-item deposit restriction. The server now rejects those deposits; legacy
quest items already in storage can still be withdrawn. Failed deposits/withdrawals
report a system-chat explanation through the existing protocol. Focused server
tests cover full item round trips, replay rejection, full capacities, partial
stack quantity conservation, Chronicle protection, legacy withdrawal and rejection
feedback with unchanged ownership. The before-fix quest deposit failure remains
in `/tmp/eidolon-phone-stash-server-before.log`.

Full server race suite passes: root 12.210 seconds, game 205.028 seconds,
`/tmp/eidolon-phone-stash-server-race.log`; this precedes only the version-label
change. Final versioned client suite passes **182 suites / 2,530 tests**, 136.944
seconds; lint passes. Logs `/tmp/eidolon-phone-stash-final-{client,check-lint}.log`.
Separate 1.0.34 patch notes and login/package/runtime metadata are synchronized.
The complete anonymous regression passes **43/43 in 5.6 minutes**,
`/tmp/eidolon-phone-stash-anonymous.log`, session `43104` finished. This candidate
is ready for commit and ordered integration; it is not yet published.

These checks use desktop Chrome phone viewports, not physical devices or sustained
play. Remaining town-service layouts, camera composition, phone keyboards and
wider campaign/1.1–1.10 gates remain open. Publish only after the separate
1.0.28–1.0.33 full CI/live gates, in order. Merge later main evidence on integration.
