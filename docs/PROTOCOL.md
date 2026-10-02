# Eidolon Wire Protocol

Eidolon uses a mixed WebSocket protocol. Client intents and lossless control
messages are JSON envelopes with a required `type` and a JSON `payload`.
Authoritative world state is a binary protobuf envelope prefixed by `EDPB`, a
wire-version byte, and an envelope version inside the protobuf payload. Alpha
1.0 uses wire/envelope version `2`, which widens level-cap XP fields to int64.

## Compatibility policy

- JSON message names are stable within an alpha line. New optional payload
  fields are backward compatible; removing or changing a field requires a new
  message name or an explicit compatibility branch.
- The `EDPB` wire version changes whenever the framing or protobuf schema can
  no longer be decoded by an older client. Unknown wire or envelope versions
  must fail closed, never be guessed.
- Protobuf fields are additive. Existing field numbers are never reused, and
  removed fields stay reserved.
- A server accepts only registered inbound message types. Every type declares
  authentication state, a payload-size ceiling, and a token-bucket rate limit.
- Feature handlers live in a dispatch registry; the remaining legacy core
  actions use the compatibility switch after the same admission policy gate.
- WebSocket input is capped at 8 KiB. Malformed bytes either decode to one
  valid message or return an error without mutating game state.

## Town recovery movement context

Starting in Alpha 1.0.19, `recall` and `respawn` accept an optional
`movementContext` string (at most 64 characters). Updated clients generate a fresh
opaque identifier per request. An accepted recovery atomically installs it and
returns the lossless JSON control message
`{"type":"movement_context","payload":{"movementContext":"..."}}`.
Rejected requests do not change or acknowledge the context. Reusing the current
nonempty identifier is rejected. Fresh join and session resume also send the
current context; it is session state, not a persisted character field.

Clients include the **acknowledged** context in every `move` and `jump`, switching
only on the server reply and publishing a fresh movement sample afterward.
Network movement checks the context under the actor/world locks: stale contexts
are rejected while the fresh recovery context can move immediately. This replaces
the one-second recovery hold for updated clients, preventing local movement toward
an NPC while the server still places the character at the town spawn. Sequence,
ability-lock, crowd-control, movement-bound and instance-geometry checks remain.

Omitted/empty contexts retain the existing one-second recovery guard for legacy
clients. Other scene transitions still use that guard and do not gain early
movement merely because an earlier recall supplied a context. This additive JSON
extension does not change EDPB version 2. The identifier is not a secret or an
anti-cheat credential, and this change is not a redesign of movement authority.

### Prepared network walking authority (not yet published)

The partial 1.72 source additionally meters canonical horizontal walking using
the entity's server-derived speed and elapsed server time. A character can retain
at most two seconds of travel credit to accommodate coalesced/delayed samples;
idle time, packet frequency, sequence zero, reconnects, and recovery contexts do
not grant an unlimited travel burst. Collision/floor clamps run before charging
the actual displacement. Internal server repositioning remains trusted and does
not reset this transient, non-persisted allowance.

Fresh, matching-context speed/discontinuity rejections acknowledge the processed
`sequence` with the unchanged authoritative position. Updated clients discard
that prediction and reconcile instead of continually replaying a denied move.
Walking retains server-owned height (or resolves the overworld terrain height),
rather than accepting an airborne Y coordinate from a client. Stale sequences,
departed contexts, invalid/non-replicable numbers, and movement
locks are still rejected before changing the acknowledgement or allowance.
This is a walking guard, not a claim that jump/cast/PvP authority is finished;
those boundaries and connected route compatibility remain release requirements.

The partial source also checks a network walk's whole canonical dungeon/expedition
segment using the existing wall guard: another room's valid endpoint cannot grant
passage through a wall, while real doorway overlaps remain traversable. Internal
server position helpers retain their previous endpoint-placement contract.

Ability admission rejects nonfinite or float32-overflowing target coordinates
before spending mana, setting cooldowns, changing combos or emitting effects.
The existing `ability_result` reply reports `accepted: false` and
`reason: "invalid_target"`. This also covers finite JSON values such as `1e39`;
it is input validation, not evidence that every ability's range/target authority
or an entire encounter has passed connected QA.

Network jump admission also rejects invalid/non-replicable coordinates and an
attempt to restart or redirect an actor already in `JUMPING`. Its landing height
comes from the server-owned floor or destination terrain, not client Y. Existing
geometry, crowd-control, recovery-context and casino walking-only rules remain.
Jump distance/flight-speed policy is still unfinished; these checks do not make
arbitrarily long jumps safe or constitute a full movement-authority closeout.

### Prepared broadcast scene isolation (not yet published)

Only intentionally global chat, world time and public-event announcements use
an empty scene as global scope. Combat, telegraph, raid/repair and unknown future
event kinds treat empty scope as the overworld. Instance-tagged messages always
match that exact scene. The hub requires a present, connected player binding for
scene-scoped delivery; pre-join, missing/nonplayer, closed and retired recipients
cannot inherit an overworld audience.

Ability, basic-attack and hazard events capture scene when created, before later
asynchronous delivery. Ordinary/teleport/landing/Earthshaker ability emitters
reject missing sources rather than inventing overworld scope. Seraph ability
events retain their source scene as well. Existing message payloads, priority
queues and drop/retirement policies remain, and intentionally global messages
retain their audience. This is scene isolation only: same-scene distance/interest
filtering, connected route checks and bounded asynchronous event staging remain
separate unfinished protocol work.

## Build-action receipts

Alpha 1.0.20 accepts optional `requestId` strings (up to 64 characters) on
`selectBranch`, `unlockTalent`, `resetTalents` and `select_rune`. Updated phone
menus generate an identifier per deliberate action. Accepted and rejected
actions return a lossless `build_action` payload with `requestId`, `ok` and
`message`. Requests without an identifier keep their legacy response behavior.
Malformed or oversized identifiers are rejected before build mutation.

The receipt does not carry an optimistic build or replace authoritative snapshots.
The phone UI waits for both a matching successful receipt and matching server
build state; an unrelated receipt cannot clear its pending action. A reconnect
waits for a fresh full build snapshot, then reports the observed outcome without
resending the command. Request identifiers correlate replies; they are not an
idempotency or replay-protection contract. Single-flight UI controls suppress
accidental repeated taps while a request is pending. Progression, rune validation
and point-spending rules remain server-owned. EDPB stays at version 2.

## Quest turn-in inventory synchronization

Alpha 1.0.23 sends the authoritative `inventory` array before `quest_update`
after a successful `complete_quest`. Both payloads are serialized while holding
world/entity read locks; collection consumption remains server-owned. This
prevents a completed collection chapter from leaving delivered relics visible
until an unrelated bag update. The existing `endgame_update` still follows.
No new message type or EDPB version is required.

Missing items, the wrong giver/location and repeated completion remain rejected
without a success inventory receipt or additional rewards. Clients must not
remove items optimistically. The separate asynchronous `chronicle_advance`
narrative notification is not the inventory acknowledgement and has no ordering
guarantee relative to these responses.

## Backpressure

State snapshots are replaceable and use a bounded lossy queue. Authentication,
errors, inventory, party, social, chat, and other control messages use a
separate bounded priority queue. The writer always checks that queue first. A
client that fills the control queue is disconnected instead of blocking the
hub or simulation; reconnect then restores canonical state from the server.

The browser mirrors this policy by compacting superseded state while retaining
bounded transient effects. Tests cover malformed JSON, size bounds, queue
saturation, state framing versions, and production `EDPB` decoding in the load
driver.
