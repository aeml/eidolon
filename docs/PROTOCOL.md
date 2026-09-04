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
