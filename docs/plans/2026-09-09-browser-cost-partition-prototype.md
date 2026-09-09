# Browser cost partition — unpublished prototype

Based on primary941ecf6, separate from recovery58 and its completed deployment.
No production runtime, case assertions, retry/timeout policy or local anonymous
umbrella command changes. Do not publish before the remaining proof below.

The existing three hosted jobs each run one browser worker. Each job now has
three separate required groups: ordinary file-sharded cases, independent
entrance-render cases, and independent Seraph/phone-encounter/respawn-render
cases. Only the two reviewed per-test rendering families use case-level sharding;
they have no shared beforeAll/afterAll or serial state in this source revision.
Supplemental nameplate/resource cases remain on job1, crystal/journal/combat-card
and desktop-label cases on job2. Predeploy still depends on the entire matrix.

Each stage has its own HTML report and test-results root. A failed stage retains
its exact nonzero status and stops later commands; failed launch/signals cannot
become success. No pass-with-no-tests flag, filtering by title, reduced assertion,
new GPU-runner concurrency or skipped gameplay gate.

Node24 discovery55018 used actual pinned Playwright1.61.1 without starting a
browser/server. The exact107-case baseline union matched the proposed groups,
without omissions, duplicates or empty groups:

| Job | Ordinary | Entrances | Effects | Supplemental |
| --- | ---: | ---: | ---: | --- |
|1|22|4|3|6nameplate +3resource|
|2|21|3|3|10crystal +2journal +4combat presentation|
|3|21|3|2|None|

These are discovery counts, not runtime measurements or a speedup claim.
The baseline includes all original anonymous files and the successor's existing
supplemental commands; version58 alone had a smaller set.

RED missing planner module: `/tmp/eidolon-browser-cost-plan-before.log`.
First implementation exposed a JSDOM-only missing structuredClone in the test;
preserved `/tmp/eidolon-browser-cost-plan-after.log`, corrected with an explicit
copy of the JSON manifest.15unit cases/2suites0.941s and lint passed; logs
`/tmp/eidolon-browser-cost-plan-green.log`,
`/tmp/eidolon-browser-cost-plan-lint.log`. Discovery output:
`/tmp/eidolon-browser-cost-partition-discovery.log`.
Workflow contract RED2failures in `/tmp/eidolon-browser-cost-workflow-before.log`.

Required before promotion: completed workflow-focused/fullclient checks, prepare
locked browser assets, run all three proposed groups in CI's bundled-browser mode
with independent retained artifacts, inspect rendering, measure actual duration,
then verify a complete remote release run. Current discovery and mocked exit-code
tests do not prove all browser commands, fixture independence in execution, FPS
or an end-to-end CI improvement. Preserve accepted58 ancestry during integration.
