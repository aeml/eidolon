# Eidolon Alpha 1.0 Roadmap and Status

Last refreshed: July 19, 2026

Purpose: keep one working document that answers three questions clearly.

1. Where are we right now?
2. What is the active release line working on?
3. What is the roadmap from here through `alpha 1.0`?

This doc is the practical tracking layer for the alpha-to-beta runway. It should stay aligned with `index.html`, `README.md`, `ROADMAP.md`, `docs/ROADMAP.md`, and the dated release-plan docs under `docs/plans/`.

The deeper, audit-grounded implementation plan that backs every release line below lives in `docs/plans/2026-05-03-v1-0-implementation-plan.md`. When this doc and that one disagree, the implementation plan wins because it is grounded in a direct code audit.

## Current snapshot

- Current in-game displayed version: `Alpha 0.40.0`
- Active implementation line: `0.40`
- Active release-confidence work: self-hosted locked browser dependencies, real-browser QA, QA-command restrictions, and deploy SHA/readiness verification
- Closed for planned implementation work: `0.21` through `0.37`
- The game has a large playable alpha foundation: 4 classes, 4 realms, 4 dungeons, authoritative multiplayer combat, quests, loot, forge, stash, trading house, parties, social statuses, asset caching, audio foundation, accessibility baseline, and substantial UX polish
- The biggest remaining alpha-wide risks are missing guilds and PvP, server/client architectural concentration, persistence/protocol hardening, and long-running multiplayer soak coverage
- Verification at this checkpoint: the client and all Go packages pass their automated baselines; anonymous and disposable full-character Playwright routes pass in system Chrome; the credentialed production and two-account routes are implemented but not yet live-tested
- Current hotspot measurements: `world.go` 8,466 LOC, `main.go` 4,710, `GameEngine.js` 5,548, `UIManager.js` 3,622

## Where we are now

### Shipped release lines (summary)

For per-patch detail see `index.html` Patch Notes. The summary below captures the player-facing promise each closed line delivered.

- `0.22` (closed): first-session onboarding, wayfinding, economy guidance, and dungeon route truthfulness
- `0.23` (closed): class/spec fantasy, loot tooltip clarity, forge/gem/respec coherence, reward readability
- `0.24` (closed): dungeon room-role pacing, Heroic/Mythic identity, rerun ladder, party-instance ownership clarity
- `0.25` (closed): party reward visibility, trading house UX, daily/weekly retention loop, server-authoritative daily clock
- `0.26` (closed): overworld self-movement correction smoothing without sacrificing server authority
- `0.27` (closed): remote attack/cast/charge replication and de-echo, named ability callouts
- `0.28` (closed): remote support-state visibility (Spirit Guardians, Embrace, Resolve, Intervention, Arcane Shield, Time Warp, Spell Focus) on a shared registry
- `0.29` (closed): authoritative replication of the full local self state (regen, attributes, cast speed, quests, runes, talents, debuff/buff durations and details)
- `0.30` (closed): viewport clipping audit across Forge, support windows, service windows, generated menus
- `0.31` (closed): client UX consistency layer - shared chrome, viewport safety, scene-swap cleanup, UI render diffing
- `0.32` (closed): audio foundation, audio detail control, authored-asset readiness, UI scale control, keybind clarity
- `0.33` (closed): mesh catalog expansion, dungeon boss-approach pacing, repro sandbox QA tooling, difficulty-pacing metadata, room-identity names
- `0.34` (closed): social status foundation (Available / Looking for Party / In Run / Busy)
- `0.35` (closed): remote-actor interpolation frame-spike clamping for steadier nearby player presentation
- `0.36` (closed): transient disconnects no longer drop the player to login; server-side session resume token, exponential-backoff client reconnect, connection-state HUD indicator

- `0.37` (closed): party membership survives disconnects; `partyId` / `socialStatus` ride the state stream; party members highlighted with a teal ring; social status changes broadcast proactively; `busy` blocks party invites; dungeon entry auto-sets `in_run`, overworld return auto-reverts to `available`

- `0.38` (closed): persistent `friendships` collection; friend request / accept / decline / remove server handlers; push-based online/offline presence to accepted friends; friends sub-panel in Social window; friend-online toast with 30-second rate limit and localStorage opt-out

- `0.39` (closed): extracted `internal/game/social.go`; split `main.go` dispatch switch into `friends_handlers.go`, `party_handlers.go`, `social_handlers.go`, `trading_handlers.go`; extracted `SocialPresenceController.js` from `GameEngine.js`

- `0.40` (in progress): architecture decomposition — `entity.go` exists, but current `world.go` measures 8,466 physical lines; use current measurements, not the historical 7,444-line checkpoint, for completion gates

### What is still not at alpha 1.0 quality yet

- Social systems include persistent friendships and presence, but still lack rich chat channels, ignore/block, guilds, and broader moderation primitives
- Guilds do not exist yet
- PvP does not exist as a real shipped mode yet
- Server/client monolith hot spots still concentrate risk for future feature work
- Persistence and reconnect flows have not had a deliberate hardening pass
- Multiplayer combat readability is good but has not had a multi-client soak validation pass
- VFX/impact feedback and content depth still lag behind the rest of the product

## Closed line: `0.38` friends list and presence (complete)

Release promise: a persistent friend-relationship table with push-based online/offline + status presence.

All slices shipped:
- `0.38.0`: `friendships` Mongo collection; `Friendship` struct; six CRUD methods (`SendFriendRequest`, `AcceptFriendRequest`, `DeclineFriendRequest`, `RemoveFriend`, `GetFriends`, `GetPendingRequests`)
- `0.38.1`: five `MsgFriend*` server handlers; `notifyFriendsPresence` push on join/disconnect; `friend_list` pushed on first state
- `0.38.2`: Friends tab in Social window; friend list rendering; online badge; Add Friend input; pending request Accept/Decline
- `0.38.3`: friend-online toast; 30-second per-user rate limit; localStorage opt-out (`eidolon.friendOnlineToast`); ARIA annotations
- `0.38.4`: Go DB integration tests (17); server helper + handler tests; SocialUI friends JS tests (32); UIManager toast JS tests (16)

## Closed line: `0.39` social closeout and decomposition primer (complete)

Release promise: extract the social/party/friend cluster into owned modules on server and client; primer pass before the 0.40 architecture decomposition band.

All slices shipped:
- `0.39.0`: extracted `server/internal/game/social.go` (71 lines) — social-status helpers; `GetAllParties` moved to `party.go`; `world.go` −69 lines
- `0.39.1`: extracted `friends_handlers.go`, `party_handlers.go`, `social_handlers.go`, `trading_handlers.go` (all `package main`); `main.go` 5 153 → 4 542 lines (−611); dispatch switch thinned to delegate calls
- `0.39.2`: extracted `src/core/SocialPresenceController.js` (108 lines); `GameEngine.js` 5 403 → 5 347 lines (−56); party-highlight, social/party/friend message routing, and UIBindings wiring moved to controller
- `0.39.3`: regression QA pass — 932/932 JS green, all Go packages pass

DoD note: `world.go` (9 325 LOC) and `main.go` (4 542 LOC) exceed the original slice targets (7 500 / 3 500); full reduction is deferred to the 0.40–0.43 architecture decomposition band.

## Active line: `0.40` — architecture decomposition (in progress)

Release promise: extract entity, talent, rune, combo, dungeon sub-packages from `world.go`; reduce `world.go` below 3 000 LOC and `main.go` below 2 000 LOC by end of `0.43`.

Slices shipped so far:
- `0.40.0`: extracted `server/internal/game/entity.go` (953 current lines) — entity model and related helpers. Historical notes recorded `world.go` at 7,444 immediately after extraction; the current file is 8,466 lines. Use the current release-gate evidence above rather than the historical test count.

## Roadmap from `0.36` to `alpha 1.0`

This roadmap targets the last alpha build before beta, not just a healthy mid-alpha. Each release line below is a band of patches with one promise. The v1.0 implementation plan defines the slice contents inside each band.

The bands run in two parallel tracks:

- **Track A (Stability):** `0.36`, `0.40-0.47` — reconnect, decomposition, persistence, perf, multi-client harness
- **Track B (Features):** `0.37-0.39`, `0.50-0.89` — social depth, chat, economy, guilds, PvP, endgame

Track A leads. Track B follows. Both converge at `0.90` for pre-beta hardening.

### `0.36` - Reconnect and session resume (closed)

Promise: transient disconnects no longer drop the player to login. Server-side resume token, entity kept alive during a 5-minute resume window, exponential-backoff client reconnect, connection-state HUD indicator.

## Closed line: `0.37` party persistence and proto integration (complete)

Promise: party membership survives disconnects and `partyId` / `socialStatus` ride the state stream.

- proto Entity gains `party_id` and `social_status` fields
- party persists on `Character` schema; rejoin on login; release party slot only after resume window expires
- proactive `MsgSocialStatus` broadcast replaces pull-only refresh
- `busy` actually blocks invites server-side

### `0.38` - Friends list and presence

Promise: a persistent friend-relationship table with push-based online/offline + status presence.

- `friendships` Mongo collection with mutual-accept model
- friends panel inside the Social window
- friend-online toast (rate-limited, opt-out)
- relationship table extensible to ignore/block in `0.52`

### `0.39` - Social closeout and decomposition primer

Promise: the social-band features land in their own modules and the architecture decomposition begins.

- extract `internal/game/social.go` from `world.go`
- begin `internal/game/handlers/` package extraction (social/party/trading first)
- extract `SocialPresenceController` from `GameEngine.js`

### `0.40` to `0.43` - Architecture decomposition

Promise: the codebase can safely support guilds, PvP, and endgame content.

- extract `entity/`, `talents/`, `runes/`, `combos/`, `setbonus/`, `dungeon/`, `combat/`, `actions/` packages from `world.go`
- introduce instance-scoped locks; `World.Mu` becomes a top-level invariants lock
- extract `RemoteEntityVisualSync`, `JumpController`, replace `TransientEffects` if/else ladder with a registry
- split `UIManager` into `SettingsPanel`, `AssetCachePanel`, `RewardCalloutPresenter`, `DungeonDifficultyMenu`, `DeathScreen`, `PartyPanel`, `CombatHUD`, `ChatPanel`

Completion gates:

- `world.go` below 3,000 LOC, `main.go` below 2,000 LOC
- `GameEngine.js` below 2,500 LOC, `UIManager.js` below 1,500 LOC
- per-instance simulation locking documented and tested

### `0.44` to `0.47` - Persistence, protocol, perf, multiplayer coverage

Promise: every Track A foundation is hardened.

- versioned schema migration tool; Mongo indexes for auctions, friendships, character lookup
- repository pattern for character save; Mongo integration test enabled in CI
- formalized message dispatch with `MessageHandler` interface; per-message-type rate limits
- multi-client load harness with scripted scenarios; Go and JS hot-path benchmarks
- nightly soak job; two-client multiplayer integration tests; reconnect integration tests

Completion gates:

- core runtime risks are materially lower than they are at `0.35`
- reconnect, persistence, and economy flows are trustworthy under deliberate failure
- Track A is feature-complete; subsequent v1.0 work assumes a hardened foundation

### `0.50` to `0.59` - Expanded multiplayer and economy

Promise: multiplayer feels socially useful even before guilds arrive.

- `0.50-0.51`: chat channel structure (zone-scoped world, party, whisper, system) replaces the single broadcast; chat history replayed on reconnect
- `0.52-0.53`: ignore lists and block (reuses `friendships` table); report queue replaces `bug_reports.json`
- `0.54-0.55`: party readiness, ready-check, role display, in-instance member health bars; loot rules (FFA default, master loot opt-in)
- `0.56`: minimal direct player-to-player trade (both confirm, gold-cap, server-side escrow)
- `0.57`: economy telemetry (gold sources/sinks per hour) before guilds and PvP add more
- `0.58`: trading-house category filters
- `0.59`: social/economy closeout, regression QA

Completion gates:

- chat is structured enough to support guild chat as an additive layer in `0.60`
- abuse-handling primitives exist before guild and PvP scope arrives
- economy friction is lower for normal player behavior

### `0.60` to `0.69` - Guilds

Promise: guilds become a real social layer instead of a future idea.

- `0.60-0.61`: `guilds` and `guild_members` collections; create/disband/invite/accept/leave/kick/promote/setMotd; roster panel
- `0.62-0.63`: guild chat (reuses `0.50` channel system); ranks and permissions (Leader/Officer/Member default)
- `0.64-0.65`: moderation primitives (rank demotion, leadership transfer, auto-after-inactive); guild identity in name plate, social roster, optional player frame
- `0.66`: guild bank (shared stash, rank-bound permissions, gold + items, audit log)
- `0.67`: guild proto integration (`guild_id` on Entity; party-style remote-actor visualization)
- `0.68-0.69`: guild QA, multi-client soak, closeout

Decisions resolved before this band starts: guild bank in scope (`0.66`); guild progression / levels deferred to post-v1.0; cross-instance guild presence required.

### `0.70` to `0.79` - PvP foundation

Promise: PvP exists as a fair, readable, technically reliable mode.

- `0.70`: faction/relationship resolver replaces the hardcoded `world.go:6541` reject; `pvpSafeZone` distinct from movement safe zones
- `0.71`: duels (request/accept/cancel, ring spawn, first-down loses, no item/xp loss)
- `0.72`: PvP target readability — hostile target frame, name plate color, friendly fire visualization
- `0.73`: arena instance type (1v1 first, 2v2 next), reuses dungeon-instance plumbing
- `0.74`: arena rewards (cosmetic-first; defer power rewards)
- `0.75`: PvP balance pass — per-context damage scalars (precedent: `dungeonScaling`)
- `0.76`: anti-abuse (queue dodge, intentional-disconnect penalties); reuses `0.45` rate-limit primitives
- `0.77`: open-world PvP-flagged opt-in (`/pvp on`); flagged-vs-unflagged deferred to post-v1.0
- `0.78-0.79`: PvP QA, two-client soak, closeout

First-scope decision: duels then arena. Open-world PvP is opt-in only inside v1.0.

### `0.80` to `0.89` - Endgame, content, and maturity

Promise: late-alpha has enough depth to feel like a real long-tail game and the decomposition gets validated by new content.

- `0.80`: 2v2 arena tuning; first arena season concept
- `0.81`: connect guilds to dungeon flow (guild-only entry option, guild-tagged leaderboards)
- `0.82`: max-level progression reinforcement (paragon-style sub-levels or cap-bound currency)
- `0.83`: 5th dungeon — validates the `dungeon/layouts/` decomposition (should be a content-data change, not a `world.go` edit)
- `0.84`: 5th class if `0.83` validated cleanly
- `0.85`: weekly raid concept (single boss, 5-10 players, weekly lockout)
- `0.86`: endgame combat readability pass (multi-client visual soak)
- `0.87`: endgame economy tuning based on `0.57` telemetry
- `0.88-0.89`: endgame QA, regression coverage update, closeout

### `0.90` to `0.99` - Pre-beta hardening

Promise: the game is feature-complete enough that beta is about hardening, balancing, scale, and content growth rather than missing foundations.

- `0.90-0.91`: progression, persistence, reconnect audit
- `0.92-0.93`: economy, exploit, abuse-case hardening
- `0.94-0.95`: multi-client soak, perf, load validation
- `0.96-0.97`: alpha-wide polish and unresolved-risk cleanup
- `0.98-0.99`: beta-gate review, final alpha closeout, `alpha 1.0` ship decision

## Cross-cutting tracks

These do not own dedicated release lines but should be advanced opportunistically inside other lines.

- VFX and impact feedback: progress in any line that touches combat presentation
- Content depth (new dungeons, classes, realms): deferred until architecture hardening (`0.40s`) makes additions cheap
- Audio expansion beyond the `0.32` foundation: opportunistic alongside combat or UX work
- Accessibility beyond the `0.32` baseline: opportunistic alongside any UX-touching slice
- Repro sandbox tooling: extend whenever a manual QA gap is found

## Alpha 1.0 definition of done

Before calling the game `alpha 1.0`, all of the following should be true.

- The full client works well across normal play
- Core gameplay feels smooth and readable
- Remote players show correctly and their major actions read smoothly on other clients
- Dungeons and endgame are replayable enough to hold attention
- Buildcraft and loot identity are real strengths
- Social play is meaningful, not decorative
- Guilds exist and work reliably
- At least one PvP mode exists and is genuinely playable
- Persistence, reconnect, and economy flows are trustworthy under deliberate failure testing
- Beta would mainly be about scale, balance, polish, operations, and content expansion

## Active tracking rules for this doc

- Update the current version line and the "Last refreshed" date when `index.html` changes a release line
- When a release line closes, collapse its per-patch detail into the shipped-line summary above and remove any standalone "remaining work" sections for it
- Do not mark a version done until tests, QA, patch notes, and player-facing promise all line up
- When scope changes materially, update this doc before the release number moves forward
- Per-patch history lives in `index.html` Patch Notes; this doc tracks release-line promises and the active slice only
