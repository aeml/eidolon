# Desktop talent confirmation — 1.1.0 candidate

Desktop talent purchases and resets previously mutated the shared character's
displayed ranks before any server acknowledgement. A rejected purchase or reset
could therefore show a build the server had not accepted. Points were already
derived from displayed ranks; this is not a claim of free server-side points.

Desktop talents now send an identified request through the existing build-action
protocol. Only one talent change can be pending. Cards and reset controls wait
for both the matching successful receipt and the replicated build; neither
clicking nor receiving a receipt invents local ranks. Rejections are visible,
and reconnect waits for a fresh build snapshot without automatically resending.
Changing characters discards the old request. Talent cards also support explicit
Enter/Space activation with button semantics. Mobile behavior, branch/rune
selection, talent costs, effects, server validation and reset pricing are unchanged.

The first six ordinary DOM interaction cases failed on the old implementation.
Expanded focused coverage passes three suites / 50 tests in3.925s, including
receipt/state ordering, stale double-clicks, rejected and successful resets,
send failure, disconnected snapshots, unconfirmed reconnects and late replies
after a character change. Full ESLint and diff checks pass; client preparation
completed. Logs are `/tmp/eidolon-desktop-talent-{red,final-focused,final-lint}-20260912.log`.

The existing native Rogue utility purchase helper additionally requires the
visible confirmation for each real purchased rank, alongside its existing wire
rank and exactly-one-point debit assertions. The `serrated-technique` route is
queued after the active four-player dungeon and Tripwire entrance replay.
Full hosted regression and actual desktop native purchase/save verification
are still pending. No integration, deployment or broad talent-audit completion
is claimed by focused tests alone.

Hosted client job103619323840 of CI34718270509 passed414suites/6408tests134.634s
on e2ef6e51, including full lint/audit/benchmark. Log
`/tmp/eidolon-desktop-talent-ci-client-34718270509.log`. Server is still running;
browser shards and the queued native route remain pending. Do not attribute
full CI or saved-session acceptance to this partial result.

## Draft 1.1.0 patch note

- Desktop talent purchases and resets now wait for server confirmation, show
  rejected changes, and recover safely after reconnect without displaying
  unconfirmed ranks. Talent cards also support keyboard activation.
