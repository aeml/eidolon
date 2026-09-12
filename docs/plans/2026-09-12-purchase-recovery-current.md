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
Both were queued behind the active four-player run; terminal results follow.

## Native acceptance and a separate protection discrepancy

Exact a6b7d307 full CI34695573901 PASSED. Native67063 Executioner Spin PASSED
27.1seconds, zero retries, normal paid area ranks and saved High/Low radii
6/6.6/7.5/8.1. Archive `/tmp/eidolon-purchase-recovery-spin-pass-JXsA2v`.
Native40395 Guardian Roar PASSED1.9minutes, zero retries, normal and saved area
15/16.5/18.75/20.25 plus Mastery duration and natural expiry. Archive
`/tmp/eidolon-purchase-recovery-roar-pass-YHBnYv`. Logs
`/tmp/eidolon-purchase-recovery-{spin,roar}-native-20260912.log`. Both credential
scans sanitized0 and exactowned containers/images/ports were clear at termination.
These runs did not log a rate rejection, so they prove successful normal/saved
purchases, not that the conditional rejected-purchase branch was exercised.

Main-agent inspection of the saved Low Roar screenshot exposed a separate
existing issue: the status card says0%damage reduction. Server RecalculateStats
currently grants20%armor for GuardianRoarActive; offline Fighter instead sets
guardianRoarReduction=.3. The remote-effect timer receiver does not set that
offline reduction field, which the status card reads. Do not hide this mismatch
by describing an unverified protection strength. Correct actual online/offline
protection and truthful status copy with receiving-damage tests in the remaining
ability/balance pass. The26FPS snapshot is incidental, not performance acceptance.
The purchase-recovery test changes are verified; full ability protection and
1.1release are not. No production metadata change or release was made.
