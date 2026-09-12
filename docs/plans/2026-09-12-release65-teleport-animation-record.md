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
