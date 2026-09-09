# Authoritative crystal sanctum state

Status: later story candidate only, excluded from standalone Alpha 1.0.58.
This provides the server contract needed for visible crystal restoration. It is
not a rendered crystal, a completed sanctum redesign, or production acceptance.

## Contract

The existing `roomState` payload now includes `crystal` for elemental raids only:
`instanceId`, `raidType`, `element`, `name`, `stage`, `wave`, `totalWaves`,
`progress`, `x`, and `z`. Position is the authoritative final boss chamber center.
Stages are `fractured`, `repairing`, and `restored`. An ordinary dungeon has no
crystal field. Unknown or incomplete layouts do not invent one.

Entry, raid entry, initial/reconnect state and periodic room updates already use
`GetDungeonRoomSummary`; the new value is computed fresh, never stored in the
movement-only room-summary cache. Instance locks are released before reading
ritual, party or entity state. Returned snapshot values do not alias the ritual.

The live worker records completed waves under `RepairMu`; each cleared wave
contributes 33 percent, and only actual ritual completion supplies 100 percent.
This state works without an event listener and does not replay chat/callouts on
join. Clients must use its exact instance identity and discard prior-scene state.

After process restoration there is no live wave map. A cleared raid guardian plus
the same saved, exact repair proof used by the existing restart policy determines
restoration. All members of an existing party must have finished the Vigil; a
missing or unfinished member prevents restoration. When no party is present the
restart policy uses the entering character. Ready-but-unclaimed and claimed
repairs both count as finished defense. Boss death alone, an unaccepted objective,
or another crystal's objective does not. Partial waves still restart in full.

No save-schema change, item grant, reward claim, quest auto-acceptance, or portal
unlock is introduced. Ilyra's manual turn-in remains required.

## Evidence

- Red98986: actual serialized room summaries had no crystal state. All four
  initial identities, live repair and restoration cases failed as expected;
  ordinary-dungeon omission passed. `/tmp/eidolon-crystal-snapshot-before.log`.
- Focused15817: Go race checks passed4.192s, including existing repair/resume
  behavior. `/tmp/eidolon-crystal-snapshot-after.log`.
- Expanded26468: Go race checks passed7.332s: all four reconstructed raid worlds,
  ready/claimed objectives, five-member readiness, real three-wave background
  worker and non-aliased progress snapshots, plus room/instance regressions.
  `/tmp/eidolon-crystal-snapshot-expanded.log`.
- Actual entry serializer68366: race checks passed1.564s for all four realm
  identities in `MsgEnterInstance`. `/tmp/eidolon-crystal-snapshot-protocol.log`.

The wave-worker test explicitly clears spawned enemies as a server fixture; it
is lifecycle evidence, not earned raid combat. The reconnect proof reconstructs
world/quest snapshots, not a full Mongo/network/browser restart. Full server
regression, actual reconnect/live-update transport checks, authored crystal
rendering and earned group progression remain required before release.

## Next visual work

Consume this state in four distinct crystal sanctums, with a bespoke clothed
Maelin and readable ritual animation. Test desktop/phone High/Low views, scene
cleanup, missed callouts, reconnect during and after repair, and all four full
raid defenses. Keep damage telegraphs visible and do not add an enclosing glow.
