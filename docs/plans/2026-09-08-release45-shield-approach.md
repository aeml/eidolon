# Release45 shield QA approach correction — not yet republished

CI34203281024 on0ed54b2 is terminal FAILED. Client/server/browser smoke and
animation gallery passed; disposable gameplay passed the corrected talent-cost
test (30→21mana and21 after fresh login), healing/duration, Forge and other earlier
routes. Shield training verified695→834capacity and saved expiry, then both
attempts failed at line131 because no Inferno Titan projected onto the uncovered
landscape canvas after12 fixed northward movements. Deployment/live jobs skipped.
The artifact log also contains transient ERR_NETWORK_CHANGED failures in an
earlier retried route; this correction does not claim to eliminate host networking
changes. Do not alter other runner jobs or services.

The absorption fixture needs to walk up to a real enemy, not click a projected
enemy through a narrow phone viewport. It now observes the nearest living,
active Inferno Titan from replicated state and uses the existing15-step ordinary
ground-click approach. A new explicit distance-under3 assertion must pass before
waypoint protection is removed. The existing real-hit absorption, shield visual,
expiry and saved-rank assertions remain. No enemy, player stat, mana, capacity,
damage or timer fixture has been changed to make the assertion pass.

Focused13178 passes12tests/two suites/1.123s, full lint and diff checks. This is
test-only; src/server/index are unchanged from0ed54b2. Actual corrected absorption
and clean artifact/cleanup evidence remain required before publication. Existing
release45 patch notes still accurately describe its unchanged production code.

First corrected actual45665 failed42.5s after capacity/expiry checks: it found
an enemy but remained21.77units away after15 movement calls. The movement helper
returns once one unit is observed by default, so repeated seven-unit commands
were being replanned before their intended travel completed. Approach now requires
up to six actual units per step (less near contact), within the same15-step and
240s bounds. The explicit under3 contact assertion is retained, not relaxed.
Initial observed distance is now logged. Scan0/cleanup/container absence passed
for the failed attempt; do not repeat its unchanged source2e45825.

Final d864474 passes11 focused movement/selection tests/1.083s, full lint and
diff checks. Actual43571 PASS40.6s/43.3s total. Nearest observed InfernoTitan-210
began34.318units away; the existing bounded ground-click path reached under3.
After waypoint protection was removed, the real enemy hit consumed310 of the
834-point shield, leaving524 with its attached visual still active. Baseline695,
trained834, saved expiry and town return all passed. Artifact scan0sanitizations,
script cleanup and independent exact-container absence passed. No production
source change; the earlier full CI client/server passes remain applicable to
runtime, while this new test-only correction will receive a fresh CI attempt.
Log `/tmp/eidolon-release45-shield-movement-gameplay.log`; handle closed.
