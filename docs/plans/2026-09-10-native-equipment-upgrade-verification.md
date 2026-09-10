# Native equipment swaps and missing-icon repair

Status: local, unpublished. This supplements earned-upgrade QA; a prepared
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

## Release-note draft — assign version only during actual release preparation

“Unfamiliar or legacy bag items now show a recognizable equipment icon or a
neutral fallback, instead of appearing blank or requesting a missing image.”

Do not publish this under the old branch's Alpha1.0.59 identity. Integrate into
the appropriate upcoming release, give it that release's patch notes/version,
and complete CI/live acceptance. The earned-campaign upgrade driver and prepared
fixture are verification changes, not player-facing automatic equipment behavior.
