# Earth expedition search direction

The prepared search strategy in the earned campaign driver treated every
non-Skeleton/non-Imp target as an eastern Demon Orc. That sends the missing-ferry
chapter's Construct search toward x300 when no suitable streamed target is
available. Production `World.spawnEnemies` instead places Constructs in western
Earth, x[-1000,-600], z[-600,1000]. Their actual level is40.

The driver now has explicit Earth search anchors, including Construct x-800,z200.
It preserves the existing starter Skeleton, higher Skeleton, Imp and Demon Orc
anchors. Selection still prioritizes real replicated level-appropriate targets;
fallback travel uses ordinary ground clicks, not entity moves or QA waypoints.
The 100-step search bound, encounter deadline, recovery loop and server quest
credit checks are unchanged. Unsupported targets/realms fail explicitly instead
of silently searching an unrelated sector.

The missing-ferry chapter belongs to Water's narrative but its `huntingRealm`
is Earth. A regression uses the actual generated chapter to preserve that
distinction. This change does not implement or claim earned Water/Fire/Air
travel, which remains later required coverage.

Validation under Node24.18.0: the extracted old fallback failed3 of14 tests;
the corrected target, story-only-readiness and recovery policies passed63 tests
across3 suites in0.998s, plus lint/diff. Playwright discovery loaded the actual
fresh-opening route successfully; discovery does not execute combat. No new
earned Construct expedition has run. Logs:
`/tmp/eidolon-primary-construct-search-{before,after,lint,discovery}.log`.

Only tests and this evidence document change. Enemy placement, story requirements,
rewards, production client/server runtime and release metadata are unchanged.
