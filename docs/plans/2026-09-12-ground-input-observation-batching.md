# Reduce measured party-input observation overhead

Development-only QA change based on13c642dc; no game runtime, balance, boss
warning duration, preparation resources, release identity or production gate
change. The prior instrumented four-role failure is retained in
[its timing record](2026-09-12-four-role-warning-timing-result.md).

Its second warning responses spent1.6–1.8s in the ground-input helper, largely
in serial browser observations before/after a real mouse click. The old successful
strict path required11 browser evaluations. A new maximum-six regression failed
against that unchanged path, while the19 previous input tests passed(0.683s).
Log `/tmp/eidolon-ground-input-batch-red-20260912.log`.

Combined observations now cover:

- Existing primary-click/request/message observer installation and initial
  player snapshot in one evaluation; ordinary state reads do not reset hooks.
- Current hover, current production ground ray and reset of previous diagnostic
  click evidence in one evaluation. No game-owned interaction or target changes.
- Actual click receipt and resulting game intent in one evaluation.
- Return the same player snapshot that proved displacement, without an extra
  observation after successful validation.

The successful strict path now uses6 evaluations. Complete path checking,
unscaled destination projection,75ms hover settlement, maximum.25m ray drift,
real Shift/Control/mouse events, modifier release on error, hostile interception,
required displacement/arrival region, existing timeouts and survival assertions
remain. Retained phase timings name the combined initial observation explicitly;
they do not fabricate zero-cost measurements for the former separate calls.

New direct observer tests verify ordinary snapshots, single forwarding of real
click/request/message calls, no double wrapping, preservation of real return
values/errors, missing rays, and no fabricated movement or successful receipt.
Focused6suites/61tests PASS1.835s before adding the final intercepted-click
integration case; changed-file lint/whitespace PASS. Logs
`/tmp/eidolon-ground-input-batch-{green,expanded,final-lint}-20260912.log`.

Full client regression session13866 TERMINAL SUCCESS:373suites/5537tests,
361.005s, including the final hostile-interception integration case. Log
`/tmp/eidolon-ground-input-batch-client-full-20260912.log`; runtime/test source
was unchanged during that check. Final changed-file lint and whitespace pass.
Do not claim a native speedup or successful dungeon clear from
fewer evaluation calls. Native input/party acceptance remains required once65's
production native gate is terminal; no competing browser test has been started.
Primary remains13c642dc while its exact-source hosted rehearsal34674058495 runs.
