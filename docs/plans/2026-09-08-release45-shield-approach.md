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
