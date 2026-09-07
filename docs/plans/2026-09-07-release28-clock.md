# Alpha 1.0.28 CI clock repair

Original release `424e6b11579b5e7ea5c50a060dcb89011fab7126` failed CI
`34075003387` before deployment. Server checks passed; client coverage had one
failure among 2,418 tests, in `SkillStrategy`'s cooldown-boundary check. All
browser/deployment/live jobs were skipped. Alpha 1.0.27 remains fully verified.

The old test set `lastUsed = Date.now() - 999` and then expected a 1,000ms
cooldown to remain unavailable. It called the real clock again inside
`canExecute`, leaving less than 1ms before a correct result becomes `true`.
CI observed `true`. This is a scheduler-sensitive test, not evidence that the
production `< cooldown` rule needs changing. The failed log is retained at
`/tmp/eidolon-release28-ci-failed.log`.

The repair fixes Date.now within each unit case, restores mocks afterward, and
checks all three boundaries explicitly: 999ms unavailable, 1,000ms available,
1,001ms available. Production clocks, ability cooldowns, gameplay, patch notes
and version metadata are unchanged. The existing 1.0.28 player-facing notes
still describe the equipment-recovery release.

Validation uses the full coverage suite and lint in separate checkout
`/tmp/eidolon-release28-clock-HSe7Na`, branch `fix/release28-clock`. Full coverage
passes **169 suites / 2,420 tests in 199.856 seconds**, session `88429` closed;
log `/tmp/eidolon-release28-clock-coverage.log`. Lint and diff checks also pass.
Carry the same test-only repair into queued descendants without skipping their
ordered complete CI/live gates; retain the failed original run as history.
