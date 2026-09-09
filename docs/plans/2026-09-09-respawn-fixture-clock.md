# Respawn visual fixture clock correction

Release 1.0.54's first CI run, 34317808528 on 805ba0d, failed before
deployment. Server and client tests and browser shards 1/2 passed; browser
shard 3 exhausted the respawn appearance test's 120-second deadline twice.
The three respawn visibility checks passed, but the prepared actor's 0.6-second
stealth timer still held 0.2/0.35 seconds. This was not a successful release.

The fixture discarded elapsed time with `Math.min(.05, frameDelta)`. Slow
software-rendered frames therefore stretched its lifecycle timers. The new
fixture-only clock consumes all elapsed time in actor steps no larger than
0.05 seconds. Button handlers settle preceding time before starting a new
effect; duplicate or older frame timestamps cannot rewind the clock.
Production clocks, timeouts, and invisible interaction-box assertions are
unchanged.

Validation under Node 24.18.0:

- The extracted old clock failed six of nine clock regression cases.
- Corrected clock, real actor appearance, version, and sharding tests passed:
  249 tests across four suites, plus lint.
- Full client regression: 3,398 tests across 240 suites passed in 131.848s;
  lint completed without warnings.
- Actual bundled Chromium with `CI=1`: respawn appearance passed in 1.4m.
  The context reported ANGLE/Vulkan SwiftShader. The final screenshot was
  inspected and showed no enclosing box. This is a prepared visual lifecycle
  test, not an earned multiplayer respawn or sustained performance claim.

Original failed CI artifacts are retained locally under
`/tmp/eidolon-release54-browser3-proof-OtLhz9`; corrected screenshot and logs
under `/tmp/eidolon-release54-clock-proof-UqjXiD`. Corrected CI, deployment,
final live QA, and exact public client/server identities remain required.
