# Alpha 1.0.40 — clearer rites, clearer battles

Locally verified candidate after preserved Alpha 1.0.39 source
`c6145c35dc935ae197ca643ce1a3dfe75416fcd1`. Not published. Preserve the ordered
1.0.35–39 CI/deployment/live gates before publishing this successor.
Source `be9184b79df00455542395b7cf68630ecb0f0817` is preserved on
`release/40-with-rites`.

## Included work

- Bounded phone actor/action feedback, full accessible identity and pool/disposal
  cleanup from `c9c93b9`; see [phone action readability](2026-09-07-phone-action-readability.md).
- Accepted trained Radiant Strike/Beacon/Mass Revival geometry, resolved direct
  healing shape, actual target centers and planar body-edge cast intent from
  `95eac97`; see [online area implementation](2026-09-07-cleric-final-area-implementation.md).
- Compact phone combo feedback without its oversized duplicate, preserving
  desktop behavior, from `88b3e67`.
- Offline Healing Light and Radiant Strike repairs plus a separately launched
  real observer from `43fa0c3`; see [scope, controls and remaining limitations](2026-09-07-cleric-offline-areas.md).

Adds a separate 1.0.40 patch-notes entry before unchanged 1.0.39 history. Login,
package/lockfile, release metadata, server/container/deploy/CI/isolated-QA defaults
and presentation checks advance together. This is not the 1.1 release gate,
physical-phone sign-off or a claim that every class/offline modifier is repaired.

## Verification

Before packaging, full client regression passed **201 suites / 2,973 tests in
94.063s** and the actual local/observer route passed **28.9s**, including both
graphics settings, ordinary combo dispatch and private-rank-free observer
geometry. Both browser error checks and credential cleanup passed. Observer
captures are retained in `/tmp/eidolon-cleric-offline-observer-captures-EWMNt2`.

Fresh versioned client regression passes **201 suites / 2,974 tests in 95.175s**.
Full server race checks pass (root **13.049s**, unchanged game package cached).
Lint, shell syntax and whitespace checks pass. The original promoted Cleric
diagnostic overlay also passes in **0.543s**; this only covers its named consumers,
not every talent in the game.

The first full anonymous run finishes **52 passed / 1 failed in 5.1 minutes**.
The 390px encounter-composition fixture cannot import Three.js; its trace records
`net::ERR_NETWORK_CHANGED` across module requests at **09:56:12 UTC**, before
the layout assertions. Landscape/short-landscape cases pass. Retain the original
log `/tmp/eidolon-release40-anonymous.log` and trace
`/tmp/eidolon-release40-network-change.zip`. The host notification's cause is not
established; do not treat this as proven attribution to any other project or
deployment. The unchanged full rerun passes **all 53 tests in 6.0 minutes**, with
all browser error checks retained; `/tmp/eidolon-release40-anonymous-retry.log`.
No runtime or selected test edits occurred during either browser run. Version
presentation checks after the documentation refresh also pass **213 tests in
1.132s**. The final actual caster/observer repeat against the versioned build
passes **37.1s**, including ordinary Mass Revival, both quality settings, accepted
local/remote shapes, private-rank-free observation and fresh-login persistence;
`/tmp/eidolon-release40-observer-final.log`. Browser errors and credential scan
pass; disposable services/data clean up.

The read-only link monitor records link activity during the passing repeat,
`/tmp/eidolon-release40-network-links.log`, and closes at its 360-second bound
(exit 124). That observation does not establish the previous failure's cause.
All owned local verification processes are terminal. Preserve this candidate on
`release/40-with-rites`; deployment remains ordered behind 1.0.35–39.

Next broader 1.1 progression work is the [earned melee comparison](2026-09-07-earned-melee-followup.md),
not another claim that the full dungeon or physical-phone gate is finished.
