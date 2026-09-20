# Optional raid spacing — replan after a witnessed moving obstruction

Tidestar `waterraid0920a` failed after5.6minutes, zero retries, source33ada570.
All five players remained alive. A FrostGuardian moved into the Wizard's
previously clear optional spacing path, and ordinary collision stopped movement
after0.687units. This did not meet the1unit/arrival assertion, so the previous
driver aborted the full raid. No guardian/repair/claim completion is accepted.

## Evidence and bounded behavior

The preserved full Wizard attachment contains the before/after body geometry:
player(90012.19298640543,19579.770774301098), requested delta
(-0.7614140493242303,-2.223555779957678), FrostGuardian before
(90009.48327552684,19574.85290806396), afterward
(90011.2109375,19576.94140625). The existing segment/body predicate proves this
path was clear before and obstructed afterward. The movement diagnostic records
the blocked target and collision-stop count. The new capture also records the
count before the input, so future classification requires an actual increment.

Movement failure now carries a typed, structured observation and still throws.
Only optional ranged spacing may classify it as an interrupted plan: same live
instance and starting position, an accepted single move-only canvas input, new
collision stop at that planned point, and the same observed body moving from
clear to obstructing. Missing/stale receipts, unknown bodies, already-blocked
paths, UI interception, death, state changes and unexplained stops still fail.
An interruption records`moved:false`, the original failure and the blocker ID;
the next normal role step replans from fresh state. It never claims a successful
retreat or changes player/monster positions, stats, collision or network state.
Generic traversal still propagates the typed failure. Combat stall, death,
repair-wave and personal claim/re-login assertions remain unchanged.

76 focused tests across spacing, interruption, ground failure, actual helper
behavior and navigation pass in0.986seconds. Changed-file lint/diff pass. No
production/runtime changes or new full raid result are claimed.

## Artifacts

`/tmp/eidolon-water-raid-20260920-r1-iiKq4l/`: log, copied `test-results/` and
`playwright-report/`, including embedded complete party attachments. Credential
scan passed after sanitizing two files. Owned run containers are gone.

Private save: `/tmp/eidolon-party-checkpoint-waterraid0920a-TANimV/save.archive.gz`.
SHA256`e8d9f619f7bf9d2bc0709658277525e81ef06035d19a319bd02cc60f53fe85ec`.
Keep the archive private and preserve the15minute logout rule.

## Next run

`waterraid0920b` is active, clean sourceb2bf2691, launcherPID1393220 confirmed
live after verifying local ports free. Launcher/log:
`/tmp/eidolon-water-raid-20260920-r2-6ttDXK/`. Same legal five-member party,
Low quality, unchanged raid/three repair waves/manual claims/re-login, zero
retries. Luna `/root/watch_tidestar_0920b` owns terminal monitoring; do not
duplicate it or overlap browsers/deployment. Preserve artifacts before the next
Playwright run. No result yet; previous0920a launcher/watcher remain terminal.

## 0920b result and formation-contact correction

0920b failed after4.3minutes while gathering after the first room; all members
were alive. The Rogue stopped at(90003.87987528516,19649.26019470357), exactly
2.5units from the Wizard's replicated(90002.1953125,19651.107421875). All other
members were already inside the formation boundary. This was not another
optional spacing failure: the formation graph had no departure vertex at least
one input unit away that also led away from the initial contact/safety margin.

The exact logged positions reproduce `PartyFormationRouteUnavailable` without
browser timing. A regression fails before correction, then reaches the unchanged
five-unit formation through fully checked walking segments. Nearby contacting
bodies now contribute a1.5unit outward departure vertex; all body/floor checks,
minimum segment proof, encounter bounds and the gather deadline remain intact.
No teleport, collision/stat change or relaxed arrival condition.87 focused
formation/approach/spacing checks pass in0.83seconds, plus lint/diff checks.

Run log and copied reports/results are in
`/tmp/eidolon-water-raid-20260920-r2-6ttDXK/`. Owned run containers are gone.
Private archive `/tmp/eidolon-party-checkpoint-waterraid0920b-RJnkRD/save.archive.gz`,
SHA256`21344e5afd7e5345c5f3dee4cb8f3983e42c7e47c702541f95be9a593f2e454c`.
Launcher1393220 and its Luna watcher are terminal; do not poll them. No clear.

Current run: `waterraid0920c`, clean source6e6f854d, detachedPID1476048 confirmed
live, `/tmp/eidolon-water-raid-20260920-r3-tf8GwT/`. Same legal five-role party,
Low graphics, full encounter/repair/manual claims/relogin and zero retries.
Luna `/root/watch_tidestar_0920c` owns completion/failure monitoring. No other
browser/deployment workload; preserve attachments on termination. No result yet.
