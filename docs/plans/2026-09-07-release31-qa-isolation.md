# Alpha 1.0.31 near-death CI fixture repair

Original release `bacaa59c7dd2fa016d400ddeacbe90c4a51982d2` failed CI
`34085084576` before deployment. Client checks passed; the server race suite
failed `TestNearDeathAnimationQARemovesOwnedEffectsAndBlocksRecovery` at its
one-second death wait. Browser, deployment and live jobs were skipped. The last
fully verified deployment remains 1.0.30 until a successor passes the complete gate.

Fifty unchanged isolated race repetitions passed in 10.089 seconds, and the
unchanged full game race suite passed in 235.915 seconds. These passes did not
explain or repair the intermittent CI failure.

Inspection found that `NewWorld(nil)` populates randomized overworld hostiles.
The test placed its player and intended hostile at the default overworld origin.
`DisablePlayerQAProtection` correctly chooses the nearest same-instance enemy,
not a test-specific ID. An ordinary level-one Skeleton at X=0.5 can therefore
replace the test's hostile at X=1. Its normal cooldown is `5 / 1.18` seconds;
the 35% swing delay is approximately 1.48 seconds, longer than the assertion's
one-second wait. It can also begin an unintended attack during the test's earlier
out-of-range check. The original test did not verify the attacker's identity.

Adding this ordinary spawned Skeleton deterministically reproduces the same
timeout on the original fixture: **FAIL**, 1.414 seconds,
`/tmp/eidolon-release31-ambient-before.log`. This proves the fixture's random-world
dependency; the original CI log did not capture its chosen hostile, so that exact
historical spawn cannot be identified after the fact.

The repair puts only the test player and intended hostile in a private instance,
retaining an explicit closer overworld Skeleton as a regression distractor. It
still exercises the actual spatial grid, nearest-hostile command, normal range
rejection, real asynchronous swing, mitigation edge, damage event and death path.
New assertions require no out-of-range/cross-instance attack, then the intended
hostile's attack and its one-point lethal damage event. The timeout is unchanged;
there is no forced death, direct damage shortcut or gameplay modification.

One initial validation command ran from the repository root instead of the server
module and failed before running tests (`ambient-after.log`). The corrected command
passes **100 race repetitions in 22.112 seconds**:
`/tmp/eidolon-release31-ambient-after-corrected.log`.

The full repaired server race suite passes in the dedicated release31 worktree:
root **13.360 seconds**, game **242.012 seconds**, all packages successful,
`/tmp/eidolon-release31-fixed-full-race.log`. Diff checks also pass. Existing 1.0.31
player-facing healing patch notes and package/login version metadata are unchanged.
Carry this test-only repair through queued descendants, retaining ordered release
gates rather than pushing the unversioned main worktree.
