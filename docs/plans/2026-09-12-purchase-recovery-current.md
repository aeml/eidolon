# Preserve released native purchase-recovery checks

Fresh production-ref comparison confirms origin/master remains f9eb1f30. The
integration tree has the shipped integer-pixel movement probe and opaque phone
status surface unchanged, and its CI workflow differs only in the deliberately
unreleased version labels. This is a scoped comparison, not a complete release
compatibility audit or live-site verification.

It did reveal missing native purchase-recovery behavior from the released Spin
and Roar routes. Ported production5cec7780/5d58dbd5/2d2fba75/fafd2434 onto
accepted7f4df79a. A rejected attempt must leave ranks and points unchanged,
show rate-limit feedback and unlock the visible button before another deliberate
tap after1.1s. At most three attempts; other failures retain diagnostics and fail.
This does not enable automatic purchase retries in the game.

Conflict resolution preserves current Roar Mastery duration copy, paid point
accounting, natural expiry and saved-login checks, in addition to the released
area/rejection checks. The status card is brought into the viewport for evidence
and closed through its visible Close button, retaining the Fortress correction.
No runtime abilities, purchases, currencies or cooldowns are changed.

Four suites55tests passed4.867s (mobile build, talents, duration copy, phone
status); lint/assets/diff pass. Logs
`/tmp/eidolon-purchase-recovery-current-{tests,lint,assets}-20260912.log`.
These checks do not replace a fresh native replay of the combined scenarios.
Both remain queued behind the active four-player run, not accepted or deployed.
