# Respawn visual fixture — release 60 CI timeout investigation

Status: locally verified test-harness correction; new release pipeline pending.
No gameplay, renderer quality, viewport, version, deadline or assertion changes.

## Authoritative failure

CI34427816379 on3a139c0 is terminal failed. Client/server and browser groups1/2
passed; group3 passed24 tests and failed the respawn appearance case twice at
120 seconds. Predeploy, deployment and final live checks were skipped. The
previous df91bb6 runtime remains the deployed60, not an accepted final release.

Failure artifact10133758335 is retained at
`/tmp/eidolon-release60-browser3-failure-akHxw8`; log at
`/tmp/eidolon-release60-corrected-browser3.log`.

Read both recorded `0-trace.trace` streams. Unlike the earlier release54 timer
bug, all three IDLE/opacity0/colorWrite-false assertions passed, stealth expired
and the final opacity assertion passed. Each attempt completed its screenshot,
then timed out with the explicit dispose evaluation unfinished. Individual
ordinary button clicks consumed approximately10.4 seconds (first click11.5s);
simple evaluation calls consumed1.6s and screenshots5.6s. These are sustained
software-renderer delays, not an observed failed hitbox/expiry assertion. The
renderer identifies ANGLE/Vulkan SwiftShader. Inspected the original final PNG:
the Rogue is visible without an enclosing glowing box.

## Candidate change

The isolated prepared visual fixture now yields50ms **after** each completed
draw before requesting its next RAF. This gives browser input/inspection an
idle interval when software WebGL draws are expensive. It does not replace the
game's scheduler, reduce graphics quality, skip lifecycle cycles, force clicks,
discard elapsed time, increase a deadline or turn off tracing. The existing
actor clock continues consuming actual RAF time in bounded simulation steps.
The stop function cancels both pending frame and idle timer and prevents late
callbacks from restarting the loop; draw errors still propagate.

This is explicitly not a production performance improvement or evidence of
physical-device, earned-combat or multiplayer respawn acceptance.

## Evidence and next gate

- Focused Node24 check77789:15 tests in2 suites passed in0.746s; lint passed.
  Covers scheduling order, complete elapsed-time consumption, both pending-handle
  cancellation paths, late callbacks, stop-during-draw and error propagation,
  plus the existing nine actor-clock tests. Logs:
  `/tmp/eidolon-release60-visual-yield-{focused,lint}.log`.
- Initial focused run exposed a missing ESM Jest import in the new tests; fixed
  before the passing rerun. Do not count that first attempt as a pass.
- Fresh-story44940 ended before the replay began; its separate Imp failure and
  sanitized archive are retained in the primary story evidence. No overlap of
  owned browsers or heavy regression with the browser replay.
- Initial browser67098 failed during module loading because this diagnostic
  worktree lacked ignored vendor assets; the visual scene never ran. Retained
  `/tmp/eidolon-visual-yield-startup-proof-AmIcGE`. The mistaken `npm run prepare`
  command has no script; `npm run prepare:client` then completed successfully.
- Bundled Chromium/SwiftShader79068 PASS1/34.8s on code f827c80, CI=1, retries0,
  same120-second deadline and full rendering/assertions. Final PNG inspected:
  same1280x720 view and visible Rogue, no enclosing cube. Archive
  `/tmp/eidolon-visual-yield-render-proof-ZM4ryD`, scan0; test web41962 closed.
  Log `/tmp/eidolon-release60-visual-yield-browser-ready.log`.
- Full39933 client PASS255suites/3612tests104.772s and lint, Node24.18.0. Logs
  `/tmp/eidolon-release60-visual-yield-full-{client,lint}.log`.
- Next: merge the verification-only correction into canonical60 and normally
  push. All CI,
  deployment, final live QA and exact public identities must pass before60 is
  accepted. No61successor or unverified deployment shortcut.
