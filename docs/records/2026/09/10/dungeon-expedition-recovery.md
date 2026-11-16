# Ordinary dungeon expedition recovery and resumed traversal

Status: implemented in earned QA; prepared native and full client/lint passed.
No gameplay resources, enemy balance, versions or deployments changed.

## Why and behavior

Earned44188 entered the Warden encounter with only40 mana. The earlier17403459
native proof established post-combat town healing/rest and same-run re-entry,
but did not continue fighting afterward. This closes that functional gap.

- Extract entry-only helper from existing enter/inspect/Recall helper, preserving
  its real portal/guide UI, level/story gates and error checks.
- At a completely cleared room boundary with no hostile within40units, the
  earned driver recalls if health or mana is below80% (also retaining ordinary
  two-cast minimum). This is QA expedition planning, not a new gameplay rule.
- Use ordinary Recall with respawn forbidden, wait for full town pools and
  increased Well Rested bank, then enter through the guide without a reset.
- Assert identical instance/seed/generator/difficulty/level/cleared rooms,
  Gold, bag items and quest progress. Rewalk all actual corridor joins from the
  real entrance, keeping the original defeated set and reward baseline.
- Never rest inside the combat loop. Preserve encounter/damage-stall/world-state
  watchdogs and one40minute expedition deadline including recovery.
- Earned route enables normal recovery unless its existing explicit diagnostic
  opt-out is selected. Legacy prepared dungeon routes remain unchanged; the
  explicit isolated prepared-dungeon-rest route exercises recovery and requires
  at least one actual mid-route rest before the later boss can complete.

## Verification

Runtime9a48db1c23695ef8cfdfa7d01a05e2e2c5f91552 was clean/frozen for31572 native:
terminal0, one test4.1minutes, zero retries, seed5956274051757442660/generator2/
attempt0/no fallback, normal30/preparedWizard100. Actual Warden death preceded
room2 rest: mana1266/1685→1498/1853townarrival→1853/1853full. Rest bank
0→1.254262286→3.333802335seconds. Same-run equality passed, followed by actual
cleared-corridor traversal, later spawned mob kills and BriarMatron death.

The second post-Matron ordinary Recall/rest/re-entry passed: mana1075/1685→
1319/1853→1853/1853 and bank0→1.319983535→4.520987801seconds. Rooms1–4cleared,
later rooms unfinished. Max-pool changes are normal Well Rested effects, not
fixture commands. Actual credential scan passed0sanitized files; owned API/Mongo
containers and18580/18581/41980listeners absent after cleanup.

Archive `/tmp/eidolon-dungeon-resume-proof-VOLgLL`; native log
`/tmp/eidolon-dungeon-resume-native.log`. Recordings disabled: input/state proof,
not screenshot acceptance or physical-phone performance.

93899/final92545 passed27focused tests/three suites+lint. First full87157 failed:
300suites passed, one existing entry test could not load because its helper
double lacked recovery exports;4196tests passed127.773s. Retained failure in
archive `failed-first-full-client.log`. Lint did not run after that failure.

Test-double-only e7214825 adds the missing exports; no runtime/browser code
changes from native-tested9a48db1c.27102 passed35tests/four suites0.997s+lint.
Final82369 terminal0 oncleane7214825:301suites/4204tests130.817s plus lintNode24.
Logs `/tmp/eidolon-dungeon-resume-verified-full-{client,lint}.log`, also archived.

## Still required

Prepared level100/protection is not earned31 survival/balance or depleted-HP
proof. Earned96530/44188 remain authoritative failures. Inspect earned kit/cast
resource needs and run a short appropriate-level combat diagnostic before
another long fresh campaign. Full four-boss clear/manual reward/save/Water
handoff, all classes/groups/realms/raids and wider roadmap acceptance remain open.
Canonical60 release acceptance still precedes successor promotion. Do not label
these QA changes as a newly deployed gameplay feature or repeat completed gates
as though their evidence is missing.
