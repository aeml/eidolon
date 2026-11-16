# Four-player traversal accounting — verification-only follow-up

The active Verdant budget run spends much more wall time in traversal than
combat. That alone does not establish equivalent human walking time or justify
changing rewards, regeneration, movement speed or dungeon checkpoints. Its
traversal phase includes leader input/observation, collision planning and waiting
for three real browser-controlled followers to arrive before each next pull.

The route now reports cumulative `activitiesMs.leaderInput` and
`activitiesMs.formation` for completed attempts, including failed attempts.
These are subsets of phase totals, not extra elapsed time. Leader input includes
its observation waits; formation includes actual follower movement and checks.
They are not pure simulation movement time, and subtracting them does not
produce a human completion-time estimate. Together with routes, town-return
counts and actual combat/resource receipts, they help identify where further
measurement is needed before interpreting expedition pacing.

No input, formation distance, collision check, death assertion, enemy, reward,
timeout, route or recovery condition changed. The same action result/error is
returned, no action is retried, and all wall time still counts toward the
existing overall deadline. No new timers or character identifiers are recorded.

The new accounting tests first failed three cases on the previous helper.
Four focused timing/real formation suites then passed77tests16.341s plus targeted
lint/diff. Logs `/tmp/eidolon-party-traversal-timing-{red,green}-20260912.log`.
This does not retrofit measurements into the already-running832ff72e test,
which remains untouched. Native measurement is queued for a subsequent required
dungeon replay, not grounds to restart the current run. No player-facing patch
note is needed for this test-only change; the provisional boss-balance draft
note and its full-clear/reward-per-minute acceptance remain separate.
