# Casino notification identity binding

Prepared Alpha 1.79.85 source `8ce0fbb0bf78eb58f5451e1d82afacc7027bd43b`
failed its original [CI39233368985](https://github.com/aeml/eidolon/actions/runs/39233368985),
attempt one. All three hosted browser shards passed: 544 passes, 14 existing
exclusions, zero failed or flaky outcomes. The server job failed; five dependent
jobs were skipped. This source did not deploy. Accepted 84 remained the live
baseline until corrected85 delivery; its earlier pass does not waive this
newly observed counterexample.

The race detector caught `bindPlayerID` writing under `sessionsMu` while
`notifyHousePresentation` read the same pending client's ID after releasing that
mutex. Authentication can register a connection before its character is bound.
Copying pointers alone did not establish a safe identity snapshot. A short
ordinary-join probe reproduces the actual race against unchanged production
code. A separate probe also rejects exposing an unbound public-name target.
Both baseline failures are retained, rather than retried or classified as setup
errors. They involve one join and one notification, without a load loop.

The correction reuses `activeClientSnapshot` for house notifications and casino
action peer updates. That helper observes a nonempty, immutable player binding
under `sessionsMu`, then releases it before world lookup or sending. Pending
connections receive no character notifications. Public-name invitation lookup
likewise requires a bound character. A pending account's exact or case-folded
stable key cannot redirect to another player's matching public alias. Existing
closed/retired-session, ambiguous-alias, stable-key and ownership behavior remains
covered by the existing tests.

Eight focused race-enabled checks pass, including both reproduced regressions
and the public-name ownership/routing checks. All five original gameplay cases
pass with a race-enabled application and tests, including quest-object casting
and saved discovery across restart. A separate fresh Mongo fixture passes all
24 house cases, including real two-guest Gold roulette and EP baccarat wagers,
departure settlement and fresh-process wallet recovery. The socket pair finishes
in 136.14 seconds; both groups keep their original 180-second deadline. Neither
group skips cases or reports a race. Related casino notification and structured
chat routing checks also pass under the race detector. Every owned container is
retired afterward. These are bounded ordinary-operation checks, without soak or
capacity traffic. Reports are retained privately in the owned casino worktree
under `.qa-casino-experience/identity-*` and
`casino-identity-race-investigation.json`.

This is a server correction to the same unpublished 85 milestone. Its client
runtime, assets, synchronized version and 520 cumulative notes remain unchanged
from the prepared phone qualification. New complete own CI, deployment and exact
public verification are required before acceptance. Those requirements now pass
at corrected source6d3561822 in [accepted85](2026-10-19-release1-79-85-acceptance.md).
No soak/stress, physical
device, whole-game performance, owner casino assessment, beta or full-goal gate
closes here.
