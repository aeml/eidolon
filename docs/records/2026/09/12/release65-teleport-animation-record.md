# Release65 Teleport animation observation repair

Production CI34675345557 at1af5951 terminated in native Wizard animation QA.
Both attempts waited for a newer local `lastAbilityPresentation` for Teleport,
but retained the previous Dragonfire Lance record. Deployment was skipped.
Fighter/Rogue animation matrices had passed before this terminal Wizard failure.
Gallery, Well Rested lifecycle, hosted client/server/browser gates also passed.
These partial successes do not authorize a live65 claim.

Source explains the mismatch: Actor.useAbility intentionally suppresses
speculative Teleport endpoint VFX. The accepted server event goes through
AbilityController.reconcileLocalAbilityShape and triggerRemoteAbilityVisuals,
which records `lastRemoteAbilityPresentation`, including for the local owner.
The matrix watched only the local prediction record at all three read points.

Use the authoritative record for Teleport only, and retain the local-input
record for every other ability. The browser-serialized reader has no fallback
to predicted Teleport effects. Continue requiring the expected skill, a newer
timestamp, exact enabled layer count, animation, finite scene transforms and
visible effect objects. No cast input, class/rune coverage, gameplay runtime,
timing budget or retry policy is removed or changed. Failure diagnostics now
include both records. Six reader tests cover missing/accepted/stale records
and representative other-class skills.

Failure log `/tmp/eidolon-release65-production-native-34675345557.log`;
sanitized archive `/tmp/eidolon-release65-animation-failure-sNXtW5`.
Credential scan reported0 sanitized files and the disposable services were
removed; local18185/18186/41875 checked free before the scoped native attempt.
Candidate browser dependencies prepared. Native Wizard matrix execution,
full CI and versioned deployment acceptance remain required before publication.
This is a release65 QA correction, not another version or a balance change.

## Scoped native result

The first local Wizard run74130 passed Teleport but failed a later Meteor Drop
rune cast (sequence21,56.0s). Its timeout observed only the previous Meteor
presentation. Preserve that failure in `/tmp/eidolon-release65-meteor-failure-dvvaL9`;
there is not enough evidence to attribute it to a gameplay defect or claim a fix.
Hotkeys use direct keydown callbacks, not frame-polled short presses.

Added before/after read-only diagnostics for transient stun/menu/jump gates,
selected rune, unlocks, targeting and the prior presentation timestamp. Do not
clear those gates, retry a failed cast or broaden its acceptance criteria.
Seven helper tests pass0.619s; changed lint/diff checks pass.

Native88301 then PASS1.1m (1.2m total): the complete Wizard ability/rune matrix,
movement, jump, basic attack, both graphics tiers and death/respawn. Sanitized
archive `/tmp/eidolon-release65-wizard-accepted-rgWYmh`, scan0. Inspected its
final screenshot: visible character shield and ground utility effect; it is
one captured instant, not evidence for every effect by itself. Temporary
services cleaned up and41875/18185/18186 free after terminal success. Full
production CI and independent live release/health checks remain required.
