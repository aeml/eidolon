# Earthshaker and Whirlwind native gates on current integration

Parent7f4df79a is the accepted integration tree, including recovered startup,
fence batching and verified Smoke Bomb. Ported the existing Earthshaker8e6189a6
and Whirlwind01dbe625 native routes without replacing their paid rank, rune,
saved-login, geometry or lifecycle requirements.

Both independently authored routes inserted after the older Whirlwind stage.
The merge preserves that older stage, then Earthshaker, then Whirlwind area,
then existing phone coverage. Both timing catalogs and enrollment assertions
retain both additions; neither route is silently dropped to resolve adjacency.

Review found the pending Whirlwind scenario selected branchB, but the actual
Fighter skill catalog puts Whirlwind in branchA. A new regression reproduced
the mismatch (1fail/4pass); the route now selects branchA through normal UI.
Earthshaker remains branchB. No runtime skill ownership or saved branch changes.

Five focused suites66tests passed6.464s. Nine expanded suites207tests passed
10.830s, including both actual presentation/offline implementations. Lint,
client assets, shell syntax and diff checks passed. Logs:
`/tmp/eidolon-fighter-area-current-{red,tests,expanded,lint,assets}-20260912.log`.
Neither test discovery nor these unit results proves native acceptance. Run
each scoped route only after current party7792 releases the native GPU lane.
No production release or version bump accompanies this test-only candidate.

Native63410 Earthshaker PASSED1.1m on6263f4e8, zero retries: all15 normal
purchases,6/6.12/6.6/7.5/8.1 radii, Fissure high/low, Aftershock both phases and
stored origin, saved points/runes/landscape and Seismic checks passed. Archive
`/tmp/eidolon-earthshaker-current-pass-FiKJSJ`, original
`/tmp/eidolon-earthshaker-current-native-20260912.log`. Main agent reviewed low
Fissure and saved low Aftershock screenshots. Scan/owned cleanup passed.

Native72405 Whirlwind PASSED55.2s/56.8s total on the same6263f4e8, zero retries.
All15 purchases, rank0/1/5 and generic area bonuses, actual paid30mana, Extended
duration, accepted shape, attached boundary frames/natural expiry and saved
landscape high/low checks passed. Low Extended screenshot reviewed. Archive
`/tmp/eidolon-whirlwind-current-pass-eYKlcR`, original
`/tmp/eidolon-whirlwind-current-native-20260912.log`; scan/owned cleanup passed.
Full candidate CI34695174069 completed successfully; detailed job logs and
combined-integration checks remain separately recorded in the execution ledger.
These native area checks are not enemy-hit/whole-dungeon/earned-progression proof.

Related source-review findings still open: the separate Fighter damage-buff
scenario uses the status launcher for closing, unlike the tested visible Close
button used by Fortress; address when porting that route. Blade Storm's nominal
10unit cone visual is not a finite hit radius: its five daggers travel under
projectile lifetime rules. Do not claim Fine Motor is fixed there by merely
enlarging the cone mesh; reconcile the projectile/range/presentation contract
before implementing or claiming that remaining talent consumer.
