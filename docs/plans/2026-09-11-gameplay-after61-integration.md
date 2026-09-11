# Gameplay successor after domain migration

Local integratione6d56231 merges accepted narrow gameplay candidate475c6d27 into
published domain candidate33c2faf4. This is not yet a new numbered release or a
production claim. Alpha1.0.61 must finish its live acceptance before this successor
is published with its own version and consolidated player-facing patch notes.

The merge is conflict-free. Exact website/workflow comparison against33c2faf4
is unchanged; the new public backend default, login1.0.61 label, explicit QA
overrides, Origin allowlist, exact-tested-commit SSH checkout and new live QA
endpoint defaults are preserved. Browser partitioning/required rest rendering
are retained from the gameplay candidate, not substituted for release checks.

84753 focused integration PASS281tests/7suites10.05s: version/history alignment,
actual temporary-Git checkout cases, endpoint selection, browser plan/coverage,
equipment detail refresh and move-only controls. These are targeted checks, not
the full current-source client/server/native acceptance. The source contains no
root/slow repair yet; that separate integrated source is undergoing full race
validation before carrying it here. Unfinished Shield Slam talent/copy work is
not included. Expanded campaign/new reward curve/Dark King phase caps and full
four-role driver remain in primary, not silently marked shipped by this branch.

Next: carry accepted root/slow fix without unfinished talent changes, then full
merged-source checks and required native character/equipment/party/rest routes.
Use prior candidate evidence only for its exact scope, not as an automatic pass
for a later merged runtime. Keep1.1–1.10 roadmap acceptance intact.

## September 11, 05:17 UTC — combined full regression

The root/slow repair and its observer/client checks are now carried in frozen
8cf72eb2. Full combined command82636 completed successfully (terminal exit0):
282 client suites / 3969 tests, 199.734s; full lint; Go race root25.225s,
game427.929s, loadtest1.067s, database1.121s, lifecycle1.040s. Logs:
`/tmp/eidolon-gameplay-after61-full-{client,lint,server}.log`.

This supersedes the earlier paragraph saying root/slow was not included. The
unfinished Fighter duration stage remains excluded. No source changes occurred
during this run. Native combined-source character/equipment/party/rest and
browser acceptance remain outstanding; full regression does not replace them.
Domain61 is still queued behind the older predeploy character job. Do not
publish this successor before61 live acceptance and a new release version with
its own patch notes. No full1.1 or later milestone completion claim.
