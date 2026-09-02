# Eidolon v1.0 Implementation Plan

Date: May 3, 2026; current-state correction July 20, 2026
Current version: `Alpha 0.41.0.14`
Target: `Alpha 1.0` (last alpha before beta)

This plan is grounded in a direct codebase audit, not in roadmap aspiration. It enumerates the concrete gaps blocking v1.0, the order to address them, the files involved, and the gating criteria. It supersedes any previous "suggested milestone slice" framing where evidence in the code disagrees.

> Current-state correction: the audit list below is retained as the May 3 baseline, not as a claim about September. Reconnect/session resume, party persistence/proto fields, proactive social status, persistent friendships, and a committed real-browser harness now exist. Current measured hotspots are `world.go` 8,578 LOC, `main.go` 5,027, `GameEngine.js` 5,810, and `UIManager.js` 3,634. Production release verification passed through SHA `8b74226`; the active `0.41` visual migration preserves the same release gate.

Companion doc: `docs/plans/2026-04-18-alpha-1-0-roadmap-and-status.md` (the high-level roadmap-and-status). This doc is the deeper implementation plan that the roadmap points at.

## May 3 audit snapshot (historical baseline)

### Foundations that are real

- Server (Go, 30 TPS) with authoritative combat, abilities, dungeons, parties, trading house, social statuses, runes, talents, combos
- Binary protobuf state stream (`StateEnvelope`, full + delta) with field-level delta tracking via `EntitySnapshot`
- Mongo persistence for users, characters, auctions
- Four classes with branch/spec system, four dungeons, four realms
- 79 client Jest tests, ~184 server Go tests on game-logic correctness
- Audio foundation, accessibility baseline, asset cache + service worker, repro sandbox
- Shared remote-effect registry (`REMOTE_EFFECT_SYNC_CONFIG`) covering 8 support effects
- HUD render diffing across HP, XP, hotbar, character sheet, world map

### Concrete gaps (verified in code, not assumed)

1. **No reconnect.** `NetworkManager.onclose` does `window.location.reload()`. No session resume token, no exponential backoff, no buffered-send replay. Single most likely beta crash class.
2. **Party state is in-memory only.** `World.Parties` map; `cleanupClient` does not call `LeaveParty`. Stale party members possible. `PartyID` not on `Character` schema.
3. **`PartyID` and `SocialStatus` are absent from the proto Entity message.** All party/social visualization on remote actors must be driven by separate ad-hoc messages that don't update with movement.
4. **Social statuses are pull-only.** No proactive broadcast - the Social window goes stale instantly.
5. **Single global chat.** No channels, no whispers, no instance scoping, no rate limiting, no party chat.
6. **No friends, ignore, block** anywhere in code or schema.
7. **No guilds** anywhere in code or schema.
8. **No PvP plumbing.** A hard-coded `if (attacker.Type == TypePlayer && target.Type == TypePlayer) return false` at `world.go:6541` is the only "team" rule. No faction/ally/hostile flags. `safeZones` is movement-only, not combat-legality.
9. **No direct player-to-player trade.**
10. **Mongo persistence is effectively untested in CI** (integration test skipped without `MONGO_URI`).
11. **No multi-client / soak / load harness** (despite `cmd/loadtest` existing - it's a single-player driver). No automated guard against sync regressions.
12. **No performance benchmarks** in Go or JS.
13. **No reconnect tests** of any kind.
14. **`server/internal/game/world.go` is 8,260 LOC.** ~230-field Entity struct, talents, runes, combos, set bonuses, four hand-rolled dungeon layout generators (~400 LOC each), all `Perform*` actions, world tick, AI, hazards, threat. Single coarse `World.Mu` write lock guards everything.
15. **`server/main.go` is 4,233 LOC** with a ~2,150-line message-dispatch switch handling ~70 message types inline plus auth, persistence transforms, snapshot diffing.
16. **`src/core/GameEngine.js` is 4,799 LOC** with `handleServerMessage` spanning ~620 LOC and seven distinct internally-cohesive feature clusters wedged together.
17. **`src/ui/UIManager.js` is 3,125 LOC** mixing HUD, settings, party, chat, death screen, reward callouts, dungeon menu, asset cache panel.
18. **Coarse server lock.** `World.Mu` is taken by both `PerformAttack` and the 30 TPS `Update`, with comments noting deadlock fragility.
19. **Parallel data tables** (client `ABILITY_CONFIG` vs server `abilitySpecs`, etc.) - adding content requires synchronized edits with no schema enforcement.
20. **No migration tooling.** Schema is implicit in BSON struct tags. Talent migration is in-code defensive reset at login.
21. **Only one explicit Mongo index** (unique on `users.username`). No auction indexes. No instance/character lookup indexes.
22. **No abuse handling primitives.** No rate limits, no profanity filter, no report queue (reports are appended to `bug_reports.json` at repo root).

### Assets that derisk forward work

- The proto wire format is already versioned (`stateProtoWireVersion = 1`) and uses `EntitySnapshot` field tracking, so adding `partyId` and `socialStatus` to the Entity message is mechanical.
- The shared `REMOTE_EFFECT_SYNC_CONFIG` registry pattern is the right shape for any future "sync these fields through state stream" work.
- `dungeon_*.go` files have started extracting from `world.go` already; the pattern exists.
- `EntityType`, `InstanceID`, and threat-by-playerID primitives are already in place and will absorb PvP cleanly.
- Server tests for game logic (parties, trading, items, ability handlers) are reasonable - the regression-protection floor is real for single-machine logic.

## Reframed v1.0 scope

The previous roadmap implied a sequential 0.36 → 0.99 march. The audit shows two release lines should run in parallel because they protect different risks:

- **Track A (Stability):** reconnect, persistence hardening, multi-client harness, perf, decomposition. These derisk every feature added later.
- **Track B (Features):** social depth, guilds, PvP, content. These are the player-facing v1.0 promises.

Track A must lead, but does not have to finish before Track B can begin. The two converge at `0.90` for pre-beta hardening.

The version-line bands stay as planned but the **slice contents below are what the code says we actually need to build**, not aspirational filler.

## v1.0 release lines

### `0.36` Reconnect and session resume

Reason: `window.location.reload()` on disconnect is the single highest-impact UX/stability bug. Every other multiplayer feature gets more brittle until this is fixed.

Slices:

- `0.36.0` server: session resume token issued at login; `MsgResumeSession { token }` accepts a token within N minutes and rebinds the existing entity instead of creating a new one. The 15-minute instance-rejoin logic at `main.go:1415-1438` is the precedent.
- `0.36.1` server: `cleanupClient` keeps the entity in a "disconnected" state for the resume window instead of removing it; `LeaveParty` is called only after the window expires.
- `0.36.2` client: `NetworkManager` exponential-backoff reconnect with 5 attempts, replays buffered outbound messages, never calls `window.location.reload()` for a transient drop.
- `0.36.3` client: connection-state HUD indicator (connected / reconnecting / lost) wired through `UIManager`.
- `0.36.4` tests: server unit tests for resume-within-window, resume-after-window, resume-with-stale-token, resume-while-other-session-active. Client tests for backoff, replay, state reapplication.

Files:
- `server/main.go`, `server/internal/database/db.go` (token table), `server/internal/game/world.go` (disconnected state)
- `src/core/NetworkManager.js`, `src/main.js`, `src/ui/UIManager.js`
- `tests/`, `server/internal/game/`

Definition of done:
- a 30-second WiFi drop returns the player to their exact position with full state, no relog
- mid-fight disconnect does not lose dungeon room progress
- party membership survives a disconnect under the resume window

### `0.37` Party persistence and proto integration

Reason: parties are real but fragile. Putting `partyId` and `socialStatus` on the wire makes every later social/PvP feature easier.

Slices:

- `0.37.0` proto: add `party_id` and `social_status` to `Entity` in `proto/state.proto`; regenerate; extend `entityToProto` and `EntitySnapshot.hasEntityChanged` to track them.
- `0.37.1` server: persist `PartyID` on `Character`; on login, attempt party rejoin; on `cleanupClient`, decouple the entity but retain party slot for the resume window (depends on 0.36).
- `0.37.2` client: render party-member highlight (color / icon) on remote actors driven by `entity.party_id`. Remove the dual-source mismatch between `MsgPartyUpdate` and the state stream.
- `0.37.3` server: proactive `MsgSocialStatus` broadcast to interested clients on change (party members + anyone with the Social window open). Replace pull-only refresh.
- `0.37.4` social UX: auto-set `in_run` on entering a dungeon, `available` on returning to town. Make `busy` actually block invites server-side.

Files:
- `proto/state.proto`, `server/internal/proto/state.pb.go` (regen), `src/proto/state_pb.js` (regen)
- `server/main.go`, `server/internal/game/world.go`, `server/internal/game/party.go`, `server/internal/database/db.go`
- `src/ui/SocialUI.js`, `src/core/GameEngine.js`, `src/core/UIBindings.js`

Definition of done:
- party members are visually distinguishable on remote actors without opening the party panel
- social status updates appear in other players' Social windows within one tick of change
- `busy` blocks party invites at the server

### `0.38` Friends list and presence

Reason: friends is the smallest social step that exceeds 0.34, and the persistent relationship table is foundational for guilds (0.60+) and PvP party rules (0.70+).

Slices:

- `0.38.0` server schema: `friendships` collection with `{ aId, bId, status, createdAt }` (mutual-accept model). Index on both ids.
- `0.38.1` server: `MsgFriendRequest`, `MsgFriendAccept`, `MsgFriendRemove`, `MsgFriendList`. Bidirectional notification on state changes.
- `0.38.2` client: friends panel inside the Social window. Reuse the social-status registry from 0.34. Show online/offline + status from the proto-replicated `social_status`.
- `0.38.3` client: friend-online toast (rate-limited, opt-out via Settings).
- `0.38.4` tests: server CRUD, login presence broadcast, decline/remove, blocked-pair guard against re-add.

Files:
- `server/internal/database/db.go`, `server/main.go`, `server/internal/game/social.go` (new file lifted out of `world.go`)
- `src/ui/SocialUI.js`, `src/core/UIBindings.js`, `src/ui/UIManager.js` (toast)
- `tests/`, `server/internal/game/`

Definition of done:
- friend add/remove/list works server-authoritatively across reconnects
- friend-online presence is push-based, not pull-based
- the relationship table can be extended for ignore/block in 0.52 without schema migration

### `0.39` Social closeout and decomposition primer **(closed)**

Slices:

- `0.39.0` ✓ extract `internal/game/social.go` from `world.go` (party, social-status, friend code that 0.37/0.38 introduced).
- `0.39.1` ✓ extract `internal/game/handlers/` package: split the `main.go` dispatch switch into per-handler files. Start with social/party/trading handlers (lowest coupling).
- `0.39.2` ✓ client: extract `SocialPresenceController` from `GameEngine.js` (party + social + friend sync clusters).
- `0.39.3` ✓ regression QA pass; close out the social-depth band.

Definition of done:
- `world.go` is below 7,500 LOC ✓ *(7 444 after 0.40.0; full 3 000 target by end of 0.43)*
- `main.go` is below 3,500 LOC *(not yet met — 4 542; deferred to 0.40–0.43)*
- social-band features have a single owner module each ✓

### `0.40` to `0.43` Architecture decomposition

Reason: the code-size and lock-coarseness audit results above. v1.0 cannot ship guilds + PvP + endgame on top of a single `World.Mu` lock and an 8k-line `world.go`.

Slices:

- `0.40.0` ✓ extracted `internal/game/entity.go`: Entity struct, RecalculateStats, copy/snapshot, status-effect helpers, rune helpers, set-bonus helpers; `world.go` 9 325 → 7 444 lines (−1 881)
- `0.40.1` extract `internal/game/talents/`, `internal/game/runes/`, `internal/game/combos/`, `internal/game/setbonus/`. These are already self-contained data tables in `world.go`.
- `0.40.2` extract `internal/game/dungeon/`: DungeonInstance, room-progression, validation. Move the four `generate*Layout` functions into `dungeon/layouts/{verdant,molten,tempest,abyss}.go`.
- `0.41.0` extract `internal/game/combat/`: PerformAttack, CalculateFinalDamage, threat, handleDeath.
- `0.41.1` extract `internal/game/actions/` (forge, stash, inventory, quest action handlers).
- `0.41.2` introduce `instance-scoped locks`. `World.Mu` becomes a top-level invariants lock; per-instance locks guard simulation. Document the lock hierarchy.
- `0.42.0` client: extract `RemoteEntityVisualSync` module from `GameEngine.js` (the two big config maps + ~10 sync functions).
- `0.42.1` client: extract `JumpController` (15 jump-* methods, ~300 LOC).
- `0.42.2` client: replace `TransientEffects.createTransientEffect` if/else ladder with a registry table.
- `0.43.0` client: split `UIManager` into `SettingsPanel`, `AssetCachePanel`, `RewardCalloutPresenter`, `DungeonDifficultyMenu`, `DeathScreen`, `PartyPanel`, `CombatHUD`, `ChatPanel`. Keep `UIManager` as a thin coordinator.
- `0.43.1` regression QA, perf compare against pre-0.40 baseline.

Definition of done:
- `world.go` below 3,000 LOC
- `main.go` below 2,000 LOC
- `GameEngine.js` below 2,500 LOC
- `UIManager.js` below 1,500 LOC
- per-instance simulation locking documented and tested
- existing tests pass; new module-boundary tests added

### `0.44` Persistence and migrations

Slices:

- `0.44.0` introduce a versioned schema migration tool. Each migration is a Go function over the Mongo collections; current implicit schema becomes `v1`.
- `0.44.1` add Mongo indexes: `auctions.status+endtime`, `auctions.sellerId`, `friendships.aId`, `friendships.bId`, `characters.instanceId` (sparse).
- `0.44.2` persist what the audit identified as currently-lost reconnect state where it makes sense: dungeon room cleared map per character (so dungeon progress survives a server restart), party membership (so party survives crashes within the resume window).
- `0.44.3` repository pattern for character save: replace 180-LOC `saveCharacterDB` flattening with a mapper.
- `0.44.4` enable the Mongo integration test in CI by spinning up a Mongo container in the workflow.
- `0.44.5` add server tests for save/load roundtrip across all persisted fields.

Definition of done:
- adding a new persisted field is a one-file change, not a search-and-replace
- the Mongo integration test runs in CI on every PR
- a server crash mid-dungeon is recoverable to room granularity for at least the resume window

### `0.45` Protocol clarity and rate limiting

Slices:

- `0.45.0` formalize the message dispatch with a `MessageHandler` interface and a registry. Each handler declares its required client state (authenticated? in-world? in-instance?).
- `0.45.1` per-client per-message-type rate limits with sane defaults; abuse-case tests.
- `0.45.2` malformed-packet hardening: fuzz-friendly decode path; test that any byte sequence either errors cleanly or is parsed correctly.
- `0.45.3` write a network framing/backpressure test suite.
- `0.45.4` define a wire-format compatibility doc and the policy for proto evolution.

Definition of done:
- a malicious client cannot crash the server with malformed messages
- rate limits exist for every player-facing message type
- protocol evolution rules are documented before guilds add their own messages

### `0.46` Multi-client harness, soak, and perf baseline

Slices:

- `0.46.0` rewrite `cmd/loadtest` as an actual multi-client driver: spawn N WS clients, each running a scripted scenario (login, walk, fight, dungeon enter, trade, disconnect).
- `0.46.1` add Go benchmarks for hot paths: `World.Update`, `PerformAttack`, `entityToProto`, `hasEntityChanged`.
- `0.46.2` add JS benchmarks for hot paths: state-message dispatch, render-update signature serialization, mesh creation.
- `0.46.3` add a soak job to CI (nightly): N clients × M minutes, assert no goroutine leaks, no memory growth beyond threshold, no desync.
- `0.46.4` document the baseline numbers; future PRs that regress them by >10% require explicit acknowledgment.

Definition of done:
- the load harness exercises real player flows, not idle connections
- a perf regression in `World.Update` is caught by CI within one PR
- soak runs are a routine signal, not a manual ritual

### `0.47` Multiplayer regression coverage

Slices:

- `0.47.0` two-client integration tests in Go: party invite, party reward sharing, instance handoff, trading-house concurrent buyout, social-status broadcast.
- `0.47.1` reconnect integration tests covering 0.36 promises end-to-end.
- `0.47.2` desync detection harness: two clients in the same instance, scripted action sequence, assert state convergence.
- `0.47.3` close out Track A. Decompose status doc.

Definition of done:
- the multiplayer/network/persistence/reconnect axis is no longer an automation gap
- Track A is feature-complete; subsequent v1.0 work assumes a hardened foundation

### `0.50` to `0.55` Chat, ignore, and party UX

Slices:

- `0.50.0` channel system: `world` (instance-scoped), `party`, `whisper`, `system`. Replace the single broadcast with channel-aware routing.
- `0.50.1` chat history (last N messages) replayed on reconnect. Server-side rate limit.
- `0.50.2` whisper permissions, whisper-back convenience.
- `0.51.0` UI: chat tabs in `UIManager` (now `ChatPanel` after 0.43). Tab unread counts, Esc-to-tab-1.
- `0.52.0` ignore list (reuses `friendships` table with status `ignored`). Ignored users are filtered from chat, social, and invite flows.
- `0.52.1` block list (harder than ignore: also blocks trading-house buyouts on their items? No - block is social only, decided in this slice).
- `0.53.0` report queue: replace the `bug_reports.json` append with a Mongo collection and an admin tool to triage.
- `0.54.0` party readiness: ready-check, role display (still implicit-from-class but explicit in panel), in-instance member health bars.
- `0.54.1` loot rules: master loot vs FFA. Default FFA matches current behavior; master loot is opt-in by leader.
- `0.55.0` social/chat closeout QA. Decompose status.

Definition of done:
- chat is structured enough that guild chat in 0.62 is a one-channel addition
- abuse handling has a queue, not a file
- party UX supports raid-adjacent expectations without committing to raids yet

### `0.56` to `0.59` Direct trade and economy

Decision point at 0.56.0: ship direct trade or skip it?
- Pros: reduces auction-house friction for one-off swaps, derisks guild bank in 0.66.
- Cons: large abuse surface (RMT, scams), needs trade-window UX.
- Recommendation: ship a minimal pickup-window trade (both confirm, no gold-only trades to discourage RMT). Defer guild bank discussion to 0.66.

Slices:

- `0.56.0` server: `Trade` struct, `MsgTradeRequest/Offer/Confirm/Cancel`, both-confirm finality, server-side inventory escrow.
- `0.56.1` client: trade window UI, item drag-in, gold cap per trade.
- `0.57.0` economy telemetry: log gold sources/sinks per hour to a metrics file. Identify inflation patterns before guilds and PvP introduce more.
- `0.58.0` trading-house category filters (item type, rarity, level range) - the only real UX gap from the 0.25 trading-house pass.
- `0.59.0` social/economy closeout, regression QA.

Definition of done:
- direct trade exists with abuse-resistant defaults
- economy telemetry produces a daily summary
- trading house has the search filters players have been working around

### `0.60` to `0.69` Guilds

Open decisions before 0.60.0 starts:
- Guild bank: in or deferred? Recommend in (0.66) since direct trade is shipped by then and persistence patterns are mature.
- Guild progression / levels: defer to post-v1.0.
- Cross-instance guild presence: required (`MsgSocial`-style queries scoped to guildId).

Slices:

- `0.60.0` schema: `guilds` collection (id, name unique, createdBy, createdAt, motd, ranks). `guild_members` collection (guildId, characterId, rankId, joinedAt). `guildId` on `Character`.
- `0.60.1` `MsgGuildCreate/Disband/Invite/Accept/Leave/Kick/Promote/SetMotd`. Guild name uniqueness validation.
- `0.61.0` guild roster panel (new tab in Social window).
- `0.62.0` guild chat reuses 0.50 channel system as the `guild` channel.
- `0.63.0` ranks and permissions: rank-bound abilities (invite, kick, motd, bank if shipped). Default ranks: Leader, Officer, Member.
- `0.64.0` moderation primitives: rank demotion, leadership transfer (manual + auto-after-N-days-inactive).
- `0.65.0` guild identity: guild name in chat name plate, on the social roster, optional in player frame.
- `0.66.0` guild bank: shared stash with rank-bound deposit/withdraw permissions, gold + items, audit log.
- `0.67.0` guild proto integration: `guild_id` on Entity. Party-style remote-actor visualization.
- `0.68.0` guild QA, reliability soak (multi-client harness from 0.46), close out.

Definition of done:
- guilds are persistent and reliable
- the MMO-lite guild expectation is met without external docs
- guild bank exists and has an audit trail (no rage-quit theft)

### `0.70` to `0.79` PvP foundation

Open decisions before 0.70.0:
- First scope: duels (recommended) or arena. Open-world PvP is post-v1.0.
- Combat-legality model shape.

Slices:

- `0.70.0` faction/relationship model: `Faction` field on Entity (`neutral` default). Per-pair relationship resolver: same-party → ally, same-guild → ally, duel-bound → hostile, otherwise → neutral. Replace the hardcoded reject at `world.go:6541`.
- `0.70.1` safe-zone concept distinct from `safeZones` movement zones: `pvpSafeZone` flag on geographic regions; combat resolver checks both.
- `0.71.0` duel system: `MsgDuelRequest/Accept/Cancel`, ring spawn around the two participants, first-down loses. No item/xp loss.
- `0.71.1` duel UI: target-of-duel ring, score, surrender.
- `0.72.0` PvP target readability pass: target frame variants for hostile players, name plate color, friendly fire visualization.
- `0.73.0` arena instance type: small map, queue-up, 1v1 first, 2v2 second. Reuses dungeon-instance plumbing.
- `0.74.0` arena rewards: arena currency, vendor for cosmetic-first rewards (defer power rewards).
- `0.75.0` PvP balance pass: ability damage scalars in PvP context (precedent: `dungeonScaling`).
- `0.76.0` anti-abuse: queue dodge penalty, intentional-disconnect penalty. Reuse rate-limit primitives from 0.45.
- `0.77.0` open-world PvP-flagged toggle (opt-in): `/pvp on` flags character; flagged-vs-flagged is hostile. Defer flagged-vs-unflagged to post-v1.0.
- `0.78.0` PvP QA across duels, arena, and flagged open world. Two-client soak.
- `0.79.0` PvP closeout, regression coverage.

Definition of done:
- duels and at least 1v1 arena work and are tuned
- the relationship resolver is the single decision point for all combat legality
- abuse vectors have explicit countermeasures

### `0.80` to `0.89` Endgame, content, and maturity

Slices:

- `0.80.0` second arena bracket (2v2) tuning; first arena season concept.
- `0.81.0` connect guilds to dungeon flow: guild-only dungeon entry option, guild-tagged leaderboard for dungeon clears.
- `0.82.0` max-level progression reinforcement: paragon-style sub-levels or a cap-bound currency (decide in this slice).
- `0.83.0` add a 5th dungeon. The decomposition from 0.40 should make this a `dungeon/layouts/<new>.go` plus content data, not a `world.go` edit. This slice validates the decomposition.
- `0.84.0` if 0.83 went smoothly, add a 5th class. If it didn't, do a second decomposition pass before this slice.
- `0.85.0` weekly raid concept (single boss, 5-10 players): mini-instance, weekly lockout. Reuses dungeon instance code.
- `0.86.0` endgame combat readability pass (multi-client visual soak from 0.46).
- `0.87.0` endgame economy tuning based on 0.57 telemetry.
- `0.88.0` endgame QA; regression coverage update.
- `0.89.0` endgame closeout.

Definition of done:
- the new content shipped in 0.83-0.85 is proof that the decomposition works
- endgame loops are sticky enough to validate the v1.0 thesis

### `0.90` to `0.99` Pre-beta hardening

Slices:

- `0.90.0` full progression audit: levels 1-cap walked by automation. Persistence assertions at every level boundary.
- `0.91.0` reconnect audit: every player-action message tested for resume-mid-action correctness.
- `0.92.0` economy abuse case sweep: duplication, negative-quantity, race-condition trading-house buyout, guild bank withdrawal races.
- `0.93.0` exploit hardening: client-trust audit; no message handler should trust a client-supplied id without server lookup.
- `0.94.0` multi-client soak at scale: 100+ concurrent clients, 24-hour run, no goroutine/memory regression.
- `0.95.0` perf validation against the 0.46 baseline; address regressions.
- `0.96.0` polish sweep across combat, UX, multiplayer, guilds, PvP. Bugfix-only after this point.
- `0.97.0` accessibility audit pass beyond the 0.32 baseline (color-blind palette validation, keyboard-only flow validation).
- `0.98.0` beta-gate review: every "Definition of done" above is checked off; known limitations documented.
- `0.99.0` final alpha closeout; `alpha 1.0` ship decision.

Definition of done:
- the product is stable enough to invite broader beta usage
- every Track A and Track B promise is verified end-to-end
- known limitations are documented, not hidden

## Cross-cutting tracks (advanced opportunistically)

- **VFX / impact feedback**: any combat-touching slice can contribute. The `TransientEffects` registry refactor (0.42.2) enables data-driven VFX additions.
- **Audio expansion**: the 0.32 foundation accepts authored cues; new abilities and PvP states should add cues at their slice.
- **Accessibility**: any UX-touching slice should validate against the 0.32 baseline.
- **Repro sandbox**: extend whenever a manual QA gap is found. Multi-client repro requires the 0.46 harness to be useful.
- **Mesh/asset content**: continues moving silhouettes from `MeshFactory` into `MeshCatalog` opportunistically.

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Decomposition (0.40-0.43) breaks subtle behavior | High | High | Strict regression-test gate; lock decomposition slices behind explicit feature flags during transition; invest in 0.47 multi-client tests before starting |
| Reconnect (0.36) introduces ghost entities | Medium | High | Server-side disconnected-state has explicit lifecycle; tests cover resume/expire/double-resume |
| Guilds + PvP shipping in same release line band stretch | Medium | Medium | They are sequential bands (0.60s then 0.70s); do not parallelize |
| PvP balance kills dungeon balance | Medium | Medium | Per-context damage scalars (0.75) keep PvE tuning isolated |
| Mongo schema changes without migration tooling cause data loss | Medium | High | 0.44.0 migration tool is a hard prerequisite for any further schema change |
| Single-developer cadence cannot sustain 60+ slices | High | High | Slice sizes are intentionally 1-3 days each; reorder bands if needed but do not skip Track A |
| New content (0.83-0.85) reveals decomposition was incomplete | Medium | Medium | Treat the new dungeon and class as the validation gate, not a victory lap; budget a 0.84.5 second pass |

## Tracking and discipline

- Update the roadmap-and-status doc on every slice ship; collapse closed lines into the summary
- Per-patch detail lives in `index.html` Patch Notes only
- Each slice has: code change, tests added, patch notes entry, doc update if scope changed
- Track A slices block Track B slices in the same band when the dependency is real (e.g. 0.36 reconnect blocks 0.37.1 party persistence)
- Definition-of-done gates are not aspirational - a slice doesn't ship until they hold
- Coverage thresholds in `jest.config.js` should ratchet upward over the v1.0 timeline (set a target floor at 0.50, then 0.60, then 0.70 per band)

## Alpha 1.0 definition of done (verified)

The roadmap's existing alpha 1.0 list still applies, but each item below is now backed by a slice that ships it:

- Full client works well across normal play - covered by 0.43, 0.96
- Core gameplay smooth and readable - covered by 0.36 reconnect, 0.46 soak, 0.86 endgame readability
- Remote players show correctly with smooth actions - covered by 0.37 proto integration, 0.42 RemoteEntityVisualSync extraction
- Dungeons and endgame replayable - covered by 0.83, 0.85, 0.87
- Buildcraft and loot identity - already shipped in 0.23, validated in 0.96
- Social play meaningful - covered by 0.38 friends, 0.50 chat channels, 0.60s guilds
- Guilds exist and work reliably - covered by 0.60s
- At least one PvP mode genuinely playable - covered by 0.71 duels, 0.73 arena
- Persistence/reconnect/economy trustworthy - covered by 0.36, 0.44, 0.92
- Beta is mainly scale/balance/polish/operations/content - covered by completing all of the above

## Immediate next action

The release-confidence gate completed through SHA `8b74226`: fresh-install validation, direct `master` push, matching live client/server identities, and anonymous, persistent-character, extended gameplay/persistence, four-class animation, and two-client Playwright routes all passed. Every later release must earn the same live-tested label through its own matching-SHA workflow.
