# Native equipment swaps and missing-icon repair

Status: full client and retained native verification passed locally; unpublished.
This supplements earned-upgrade QA; a prepared
inventory fixture is never proof of earned dungeon progression or balance.

## Findings preserved

- Native17050/44aaf011: first swap reached the server; exact ownership comparison
  failed on empty JSON/protobuf defaults. ffd0a330 normalizes absent value to0
  and absent gems to[] only, preserving all other metadata and nonempty contents.
  Archive `/tmp/eidolon-upgrade-fixture-failure-KFc4hv`.
- Native43863/ffd0a330: swap confirmation timed out. Archive
  `/tmp/eidolon-upgrade-wire-failure-oysKtA`.
- Native79299/f3954216: both swaps and login ownership checks passed; final
  screenshot setup incorrectly assumed inventory also opened the character
  sheet. Archive `/tmp/eidolon-upgrade-diagnostic-failure-NTgTui`.
- Native72474/f5b09c70: two of three independent accounts passed; one first-swap
  timeout. Captured native events show dragstart, two dragenter events, dragend,
  but no dragover/drop. Failure image shows the correct visible target, unchanged
  weapon, full bag and no blocking overlay. Archive
  `/tmp/eidolon-upgrade-repeat-proof-EeGmwU`. The installed Playwright dragAndDrop
  implementation moves once unless steps are supplied; equipment-slot cloning
  was only a hypothesis, not an established cause or a reason to alter runtime.
- Native91563/a5208f00: all six swaps across three accounts and their login
  ownership checks completed with40 ordinary pointer steps. All three tests
  failed browser-health checks because generic Ring icons returned null and
  InventoryUI emitted url('null'), causing404 requests. Archive
  `/tmp/eidolon-upgrade-stepped-failure-eUcOpi`. Do not relabel any full test pass.

All completed wrappers reported their actual credential scans passed with zero
sanitized files. Original logs remain `/tmp/eidolon-upgrade-native-*.log`.

## Runtime icon correction

Known item art, named Chronicle icons and valid gem/currency icons are unchanged.
Uncatalogued equipment names with valid equipment slots now reuse an established
base-family icon for that slot, including ring/trinket pairs. Other unknown items
get a neutral sealed-parcel icon instead of blank art or a null URL. No item
names/stats/slots, balances, equipment models or game mechanics are changed.
Untrusted names are not interpolated into SVG; existing cache bounds remain.

Focused99691 PASS90tests/6suites13.381s plus lint underNode24.18.0. Coverage includes
every actual equipment slot, paired slots, canonical36 base families, malformed
types/unknown metadata, neutral fallback, gems, phone inventory and upgrade policy.
Logs `/tmp/eidolon-upgrade-icons-unit.log` and
`/tmp/eidolon-upgrade-icons-lint.log`. Full regression and corrected native repeats
remain required before integration/promotion.

## Stable equipment-slot refresh

Native63002/2741d551 had two full passes and one failed swap. Icons were visible
and missing-image requests resolved in completed cases (image inspected), but
the remaining failed drag now included actual dragover events without a drop.
Archive `/tmp/eidolon-upgrade-icons-partial-uawqJn`. Pointer steps alone therefore
did not close the drag issue. No broad native success is claimed for that attempt.

Source inspection found every changed character-sheet signature, including HP/
mana changes, rebuilt equipment slots by cloning their DOM nodes. Baseline
session38479 deterministically failed all three new equipment-refresh tests at
node-identity checks. Log `/tmp/eidolon-equipment-refresh-baseline.log` retained.

The runtime now retains equipment-slot nodes and caches unchanged item artwork.
Changed items still rebuild art; owned tooltip/focus handlers are replaced in
place rather than accumulated. Removing an item clears stale actions. Keyboard
focus survives, and a focused changed item's tooltip updates explicitly.
Same-ID Forge potency/stat changes invalidate the presentation cache.

Final focused14943 PASS91tests/6suites18.306s and lint. Logs
`/tmp/eidolon-equipment-refresh-final-unit.log` and
`/tmp/eidolon-equipment-refresh-final-lint.log`. Native fixture now explicitly
invokes the real equipment UI refresh during each dragover, without player-state
or network injection. New optional `equipment-refresh` route runs all three
independent swap fixtures and, only if successful, the existing actual Forge/
dungeon-guide scenario on its separate account. Native and full regression
verification of the combined correction remain pending.

Native79136 on0e640ef9 TERMINAL PASS: three stressed swap/account cases52.8s,
then actual Forge/guide1case24.1s. Actual wrapper credential scan passed0sanitized
and both owned containers were absent after cleanup. Archive
`/tmp/eidolon-equipment-refresh-first-pass-XltIDl` retains the surviving artifacts.
The original log is `/tmp/eidolon-equipment-refresh-native-run.log`.
However, the second Playwright command cleared the first command's default
test-results tree. Functional log evidence remains, but complete screenshot
retention was not achieved. Corrected route uses independent subdirectories
under the already-scanned test-results root. Real-shell unit checks enforce
both distinct outputs and fail-fast chaining. Rerun before final acceptance.

## Release-note draft — assign version only during actual release preparation

## Completed local acceptance

Frozen source **f2600a44** passed full client session18794:293suites,4125tests,
145.015s, followed by lint underNode24.18.0. Logs
`/tmp/eidolon-equipment-refresh-full-client.log` and
`/tmp/eidolon-equipment-refresh-full-lint.log`.

Native session41421 on the same source exited0: three independent full-bag
swap/refresh/login cases53.0s, then actual Forge/guide1case23.2s. Both item swaps
in each account exercised actual equipment UI refresh during native dragover.
The final wrapper credential scan passed0sanitized. Both owned containers and
API18570/Mongo18571/web41970 listeners were absent after cleanup.

All three equipment screenshots remained in `test-results/equipment-upgrades`
after the second command completed, alongside the Forge screenshot in
`test-results/forge-guide`. Inspected all four: generic rings have visible
consistent slot artwork; equipped and displaced items remain visible; the Forge
shows potency+2→+3, damage46→50 and the disabled insufficient-Hearts action.
These are desktop appearance/input checks, not physical-phone or FPS acceptance.

Archive **`/tmp/eidolon-equipment-refresh-proof-T4FHu5`** contains both scoped
artifact trees, final Forge HTML report, native log and full client/lint logs.
The native log is `/tmp/eidolon-equipment-refresh-retained-native.log`.
The earlier failed runs and incomplete artifact-retention attempt remain failures
or qualified evidence as described above; they are not retroactively passed.

This closes these local equipment-change gates, not earned dungeon completion,
whole-campaign/raid/group/phone acceptance or release CI/live deployment.

## Release-note draft — assign version only during actual release preparation

“Unfamiliar or legacy bag items now show a recognizable equipment icon or a
neutral fallback, instead of appearing blank or requesting a missing image.”

“Equipment slots keep their drag targets and keyboard focus during character
stat updates, while equipped-item and Forge changes still refresh their display.”

Do not publish this under the old branch's Alpha1.0.59 identity. Integrate into
the appropriate upcoming release, give it that release's patch notes/version,
and complete CI/live acceptance. The earned-campaign upgrade driver and prepared
fixture are verification changes, not player-facing automatic equipment behavior.
