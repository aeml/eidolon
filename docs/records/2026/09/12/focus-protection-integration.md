# Focus and protection — full development integration accepted

Full regression31631 completed successfully onedf6acaa:

- Client:362suites,5,202tests,101.761s.
- Full lint:passed.
- Complete Go race suite: root14.808s, game263.775s, database1.086s,
  lifecycle1.021s and loadtest1.015s; remaining packages had no tests.

The primary development worktree was fast-forwarded fromae938843 toedf6acaa.
This integrates the replicated Protected aura/countdown and stored, trained
Spell Focus charge alongside the previously accepted Teleport work. It does
not publish those changes or establish native/earned progression acceptance.

The first full run7823 on e5a3c2a6 failed only the architecture budget:
GameEngine2515lines exceeded2500. The other5,201tests passed. The unchanged
timed-effect configuration factory was extracted into its own imported module;
the budget was not relaxed. Focused checks and the full rerun above passed.

Logs: `/tmp/eidolon-focus-full-client-20260912.log` (original failure),
`/tmp/eidolon-focus-full-client-rerun-20260912.log`,
`/tmp/eidolon-focus-full-lint-20260912.log` and
`/tmp/eidolon-focus-full-server-20260912.log`.

Native Focus candidate2548f768 is separately frozen in
`/tmp/eidolon-focus-native-20260912`. It adds phone purchases, two-client effects,
fresh-login ranks and real focused/unfocused hits to the isolated full QA route.
Run64892 has started but has no result at this checkpoint. Prepared QA does not
establish earned progression or balance. Four-role dungeon acceptance, remaining
talent consumers, physical-phone feedback and the full1.1–1.10 roadmap stay open.

Release63 CI34660899212 onf866df68 is separate: hostedclient/server passed,
three hosted browser groups are running. No63live claim. The cancelled soak
stays off; the ledger-only root branch must never be pushed.
