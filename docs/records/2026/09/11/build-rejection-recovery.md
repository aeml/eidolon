# Build-menu rejection recovery — unreleased

Native Time Warp route `541ca80a` bought thirteen talent ranks through ordinary
phone controls, then left Prismatic Control rank four indefinitely pending with
seven points still available. Screenshot and diagnostic state are preserved in
`/tmp/eidolon-time-warp-training-diagnostic-h84E68`. This is a real missing
rejection response, separate from the earlier desktop-device fixture error.

Admission rejects rate-limited messages before the build dispatcher sends its
correlated receipt. The phone menu cannot associate the generic error with its
pending purchase. Four deterministic server cases reproduced this for talent,
branch, reset and rune requests; all failed before the fix (0.186s).

Valid bounded build requests now receive a matching unsuccessful receipt from
the admission boundary, including connection replacement and pending-account
recovery rejection. Rate limits, authentication, payload limits and build
mutation rules are unchanged. Legacy, malformed, oversized and unrelated
requests retain generic errors. No client optimistic spending or automatic retry
is introduced: the existing menu releases controls and lets the player retry.

Verification:

- Focused server race tests passed (1.377s), including twelve new rejection and
  compatibility cases plus existing receipt and admission tests.
- Phone build tests: 39 passed (1.010s); ESLint and diff whitespace checks passed.
- Full server-entry package race tests passed (19.043s), session58338 exit zero.
  Game package/application consumers are unchanged from the accepted integrated
  full regression; this does not claim a new whole-repository run.
- Logs: `/tmp/eidolon-build-rejection-{red,green,client,server-full}-20260911.log`.

Unreleased patch-note candidate: Fixed talent, specialization and rune menus
remaining stuck waiting for confirmation when the server rejects a build change.

Native recovery and trained Time Warp reach/duration/expiry/save proof still need
to pass. No deployment or full four-role dungeon clearance is claimed here.
