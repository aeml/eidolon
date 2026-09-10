# Release60 live hover failure — diagnostic only

Canonical df91bb66 is deployed, but CI34421323405/final live102709210653 ended
FAILED at01:36:08UTC. Anonymous/persistent-character and four-class/remote-animation
checks passed. Natural rest expiry and stat/aura restoration on reentry passed.
The sanctuary journey failed its10-second hover assertion inside town, before
the warning screenshot, combat, Recall recovery or reconnect. The party stage
was not reached. The same assertion failed once before a successful predeploy
retry; do not dismiss this second failure as harmless or accept the release.

Live failure artifact10132708546 is retained at
`/tmp/eidolon-release60-live-failure-7uE6Za`, scan0. The inspected town screenshot
precedes the boundary failure and cannot establish whether there was an available
enemy, whether its hitbox was obscured, or whether pointer processing was pending.
Log `/tmp/eidolon-release60-final-live.log`. No new deployment or blind CI rerun.

This separate worktree starts at exact60, with no runtime/version changes.
Add failure-only read observations and an entered-world screenshot at the actual
failed assertion. Record last candidate/projection, actual hovered entity/card,
pending raycast/canvas state, camera/player position and membership, projected
point's overlay identity, and the nearest20 replicated Skeletons' alive/rendered
states. Do not force raycasts, select targets, mutate actors, spawn enemies,
extend the timeout, skip the warning, or retry a no-longer-fresh character.

Focused5576 passed20tests/3suites0.849s and lint. Follow-up32896 passed21tests/
3suites0.881s and lint after retaining the last attempted projection even if a
later poll has no exposed candidate; this preserves an observable screen point
for detecting an intervening HUD overlay. It does not establish that an overlay
caused the original failure. These checks validate read-only evidence
and preserved fatal checks, not a fixed hover. When the current primary Earth
replay releases the browser slot, run the diagnostic journey against exact live60
using a fresh ordinary QA registration. Preserve and sanitize its evidence before
choosing a correction. Full regression/native proof are required for any actual
correction; this diagnostic source alone must not be deployed as a successor.
