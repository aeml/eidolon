# Iron Fortress status-panel entry

Native run20878 on accepted aeb0356e failed26.1 seconds into its first rank-zero
cast. Paid mana, replicated duration and attached character effect passed, but
the phone status panel never showed Iron Fortress. Source inspection confirmed
`syncTrackedActorBuffs` omitted this buff entirely; the native selector was not
the cause. Archive `/tmp/eidolon-fortress-native-failure-6GmvRT`, original
`/tmp/eidolon-fortress-accepted-native-20260912.log`. Disposable services were
cleaned and credential scanning passed.

The candidate adds the actual remaining Iron Fortress timer to the shared
status tracker, with a shield icon, readable name and protection description.
It does not display a fabricated reduction percentage: that strength is not
replicated into this UI path. The entry updates without duplication and is
removed when the timer expires, independently of other active buffs. No changes
to combat protection, mana, cooldown, duration or talent strengths.

The new regression failed before the runtime edit (1fail/28pass); the native
purchase/Extended-rune/natural-expiry/relogin route remains unchanged and must
be rerun. This failure does not invalidate the observed paid-cast behavior,
but it does prevent claiming the full Fortress native route passed.

The initial insertion exceeded GameEngine's existing2500-line architecture
budget (2507). Its pure actor-buff description array is now extracted unchanged
apart from the Fortress entry into `TrackedActorBuffs.js`; lifecycle bookkeeping
stays in GameEngine. The architecture limit was not relaxed. Five expanded
suites72tests passed1.581 seconds, including all active-buff, phone status,
attached-effect, observer and architecture checks. Lint/diff passed.
Logs `/tmp/eidolon-fortress-status-{red,green,expanded,lint}-20260912.log`.

Corrected runtime replay11633 failed18.2 seconds after the rank-zero badge,
countdown and character-effect checks passed. Its closing input targeted the
launcher covered by the open reading panel. The existing visible Close button
is the intended control (also used by the compact-status browser suite). The
route now taps that button and explicitly checks the panel closes; no forced
click, layout change or duration/upgrade assertion was substituted. Retained
archive `/tmp/eidolon-fortress-status-failure-6yvMsn`; credential scan passed and
owned services/ports were clear. A full corrected replay is still required.

Corrected replay59562 on c540f67f PASSED:2.2m test/2.3m total, zero retries.
Rank0/high lasted30s; five normal purchases produced36s at rank5/high; the
saved Extended rune/rank5 lasted54s after fresh login at landscape/low quality.
Paid mana, actual attached effect, displayed countdown, natural expiry and
independent Well Rested retention passed. Screenshot evidence retained at
`/tmp/eidolon-fortress-native-pass-eQlXjG`; original log
`/tmp/eidolon-fortress-close-native-20260912.log`. Credential scan passed and
the owned containers and three ports were clear before the next native route.
Four focused suites51tests passed1.123s plus lint/diff. The initial local test
invocation omitted the project's ESM launcher and executed zero tests; its
corrected npm-test result is the evidence, not that setup failure. Full CI on
the corrected source remains required before primary acceptance.
