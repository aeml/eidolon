# Teleport and protection — native acceptance route

Status: implemented test route, **not yet natively exercised or accepted**.
Built in`work/release65-native-warp`from scoped65source9ab5b644. Production64
CI34668112188 is using the native-browser runner; do not compete with that gate.
The existing hosted65 rehearsal34668886679 covers its earlier frozen source,
not these subsequent test additions.

## Required observations

The new`teleport-protection`route launches two actual system-Chrome clients,
with a Wizard owner and Fighter observer. It uses existing allowlisted level/
readiness setup, not earned progression. All specialization choices, fifteen
talent purchases, rune choices, cursor aiming, casts and fresh-login checks use
ordinary UI. No injected cast, fabricated packet, position mutation, immunity
grant or clock jump is used to obtain acceptance.

- Untrained Warp at High: two visible boundaries at accepted departure and
  landing, actualradius4, attached on both clients; displacement must exceed.5.
- Paid Mana Geometry and Volatile Insight, five ranks each: both Low-quality
  boundaries become5units, matching the accepted server event on both clients.
- Phase at High: no damage boundary; actual active/attached protection with a
  one-second server duration and no solid box/sphere/icosahedron shell. Owner's
  active buff is named Protected; both clients observe ordinary expiration.
- Paid Prismatic Control, five ranks, then fresh login: rune and all fifteen
  ranks persist, trained Phase duration1.2s at Low, then normal effect cleanup.
- Every accepted cast has an actual40mana receipt from a full stable rested
  pool and a positive cooldown. Existing town healing is not mistaken for a
  refunded cast. Both clients must stay free of recorded browser failures.

Existing dungeon movement and server geometry tests remain separate required
proof of wall behavior; this town presentation route does not claim dungeon
damage, earned progression, four-party survival or physical-phone performance.
Screenshots after cast receipts are retained as visual aids, but the short-lived
Phase may end before a screenshot; its native activation/shape evidence comes
from observations of actual scene objects after ordinary packet delivery.

## Observer and wiring

`teleport-native-observer.js` forwards every received packet once, then observes
the real effects and state. It resets evidence on each cast, reinstalls after
fresh login, filters by source/active effect, and keeps bounded histories. A
separate best actual activation survives a later inactive history so slow peer
inspection cannot erase evidence of the short Phase window. This record does
not extend or re-create gameplay protection. Focused unit tests cover both
perspectives, new documents, reinstallation, bounded inactive tails and no
fabricated effect/forwarding changes.

The isolated script allowlists exactly the owner and observer suffixes and
offers`EIDOLON_ISOLATED_QA_ROUTE=teleport-protection`. Its complete`all`gate also
adds the same no-retry route after the existing forge/socket stage without
removing or reordering any prior command.

Three focused suites PASS262tests/1.726s; changed-file lint and shell syntax
PASS; Playwright discovery sees one test in one file. Logs
`/tmp/eidolon-release65-native-warp-{contracts,lint,discovery}-20260912.log`.
These checks prove harness structure only. First native execution, inspected
artifacts and integrated release acceptance remain required. Do not promote
this scaffold as successful gameplay or merge claims of native acceptance.
