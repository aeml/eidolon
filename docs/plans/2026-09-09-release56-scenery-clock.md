# Release56 scenery restoration clock correction

Original56/9f41111 CI34337271486 failed browser shard1; other test jobs passed,
and deployment/predeploy/live jobs were skipped. Production remains55/c5ce9dc.
The anonymous browser artifact10098975954 is retained at
`/tmp/eidolon-release56-browser-failure-inyorR`. `gh run view --log` returned an
empty log, so the HTML report's embedded JSON and retained traces supplied the
failure evidence; no empty-log inference was made.

Both attempts failed the Molten Core/High/1280×720 restoration predicate at
entrance-visibility.spec.js:134, durations107.130s/105.982s. Earlier assertions
passed: occluded hero0pixels, revealed74/unobstructed76, zero changed pixels
outside the cutaway, and unchanged camera/gameplay bounds. In attempt0 the
trace's focus-clear call ended305902.292ms; restoration polls ended311161.482
false,316449.956false, then321670.666true—restored, but too late for the unchanged
15second predicate deadline. Individual evaluation calls took roughly3.4seconds.

SceneryVisibility capped elapsed time at0.1seconds PER RENDER, although its
exponential fade is a stable visual transition, not a physics integrator. This
stretched a roughly0.67second restore across many expensive frames. Deterministic
low-frame-rate regressions19058 failed all four0.25/0.5/1/2second cases against
the original code; the original ten tests passed. Log
`/tmp/eidolon-release56-scenery-wall-clock-before.log`.

The candidate uses nonnegative actual elapsed time for this visual fade. No
gameplay clock, collider, shader, threshold or browser timeout/retry changed.
Version remains the still-unreleased1.0.56; its patch notes explicitly include
the visual correction. Focused8952 PASSED245tests/2suites/1.349s and lint, logs
`/tmp/eidolon-release56-scenery-wall-clock-{after,lint}.log`.

Remaining: actual bundled-Chromium CI-mode reproduction, full client regression,
fresh predecessor public identities, normal corrected56 push and complete new
CI/deployment/live verification. Do not promote57/58 through this failed release.
