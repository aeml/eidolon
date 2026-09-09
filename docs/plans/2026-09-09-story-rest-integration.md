# Expanded Chronicle, coordinated rewards and Well Rested integration

Unversioned development candidate, NOT live and not an approved release. This
combines Well Rested `1c7537f` with expanded-story `92d2bc7` in an isolated
worktree. Inherited 1.0.57 metadata is not permission to publish this as 57.
Existing canonical 51–57 releases and their deployment order are untouched.

## Integration contract

- Retain schema9, fractional saved rest, exact resource snapshots, journal and
  auction receipts, late-login ownership protections, dead-versus-living recovery
  and the newer movement/stealth/HUD fixes from the Well Rested ancestry.
- Bring in the authored 31-chapter story: eight investigations and eight hunts,
  explicit interactions/manual rewards, existing dungeon/raid/crystal/finale
  prerequisites, legacy optional catch-up and discovery evidence persistence.
- Activate coordinated curve2 only in this candidate, alongside content budgets.
  This is not an isolated curve-only patch. Production activation still requires
  the verified compatibility release first and the full earned-play gates.
- Preserve quoted accepted/completed payouts, including explicit zero, and
  existing receipts. Genuinely absent legacy fields still receive catalog defaults.
- Apply the existing rested 25% bonus to the newly budgeted enemy-kill award,
  never to investigation, manual quest, room-clear or gold awards. Apply the 10%
  stat bonus once to final stats and preserve ordinary .01 outside regeneration.
- Keep both normal collision/failure-aware input and expanded story/Rogue/crowd
  controls. No weaker encounter watchdogs, free progress, forced recovery or
  altered kill/fragment requirements merely to make a route pass.

## Evidence and remaining work

The merge compiled all Go packages and passed lint/shell syntax checks before
full regression. Full client93503 FAILED4 suites/3tests (252 suites/3638tests
passed),216.551s: older source-name checks and test mocks assumed the previous
helper imports/evaluation shape. Corrected helpers retain actual collision
planning, scaled melee reach, Rogue shield exclusion and no-input failure handling.
Focused20772 PASS6 suites/77tests2.774s. Log
`/tmp/eidolon-story-rest-merge-input-fixed.log`; the original full failure remains
in `/tmp/eidolon-story-rest-merge-client.log`.

Full Go race62050 FAILED: root23.411s/game391.274s, exactly two failures and no
race report. One asserted curve1 was still active; the other treated the now-known
Earth diary/Watch as unknown content with immutable display metadata. The new
candidate asserts active curve2 while independently preserving every legacy
threshold and explicit2→1 fractional rollback/repeated1→1 identity. Unknown
future-content round-trip uses genuinely unknown IDs; exact zero quotes, objective
counts, evidence, optional status and saved economic state remain checked.
Focused85228 PASS(root1.407s/game10.894s). Original and corrected logs:
`/tmp/eidolon-story-rest-merge-server.log` and
`/tmp/eidolon-story-rest-merge-progression-fixed.log`. Full corrected regression
remains required. Historical documents refer to their own earlier SHAs, never
to proof of this combined candidate.

The original no-rest Well Rested collection failure remains separate evidence:
attacks registered, repeated retreats/reselection moved a level6 character into
level30 DemonOrcs. The opt-in three-rest-stop route passed but its old8000XP
turn-in produced level6→17. Neither result validates this new reward curve or
the forty-kill Watch. Actual integrated earned gameplay is still required.

Review found enemy target acquisition/movement still used the old town rectangle,
and delayed slams could damage a player entering safety during wind-up. Independently
reproduced and corrected in Well Rested badd0cf:6 target,4 movement,2 actual impact
cases plus existing concurrency/protection tests pass race8.000s. Integrated as
1816738 after the main28dd5a1 story merge. No production source changed after
the new full regression started. Regenerating Go/JS protobufs exactly matched
the merged outputs (7d2c3ec9 /75eec1c5); final lint31593 and shell/diff checks pass.
Normal prepare:client92314 finished; ignored vendor assets are present.

Corrected full Go race23067 PASS(root27.543s/game437.789s) and full client98874
PASS256 suites/3645tests240.706s on production1816738. Both handles confirmed
terminal at03:02UTC; logs `/tmp/eidolon-story-rest-integrated-full-server.log`
and `/tmp/eidolon-story-rest-integrated-full-client.log`. No race report.

Additional26402 PASSrace7.460s:8 combined durable-data cases (four classes,
living/dead), each3 BSON/catalog/full-snapshot/private-journal reload cycles.
Legacy level30/9890XP on curve1 becomes level30/10561XP on curve2 once; the
accepted500XP opening receipt,8000XP five-item collection promise and explicit
zero-payout known diary survive, including count/evidence/optional state. Base
stats/currency, exact123.456789 rest, zero mana and living1HP/dead0HP survive.
Log `/tmp/eidolon-story-rest-combined-save.log`. This new test was added after
the full suite started; its separate focused result is required evidence, not
part of the earlier full test count. No production change or actual-socket claim.

Next actual browser route: `fresh-story-uninterrupted`, ordinary opening→diary→
forty-kill Watch with no checkpoint logins, extra rest stops or grants. Preserve
the120s credit watchdog, two-respawn limit and30m route limit. This is new
combined-runtime acceptance, not a rerun of unchanged failed historical source.

After corrected full checks: verify generated protocol parity, ordinary persisted
curve1→2/rested saves, fresh uninterrupted and honestly labeled town-rest routes,
manual investigation/hunt/collection rewards and all-class/realm progression.
Only then package version/patch notes and follow ordered CI plus exact live checks.
