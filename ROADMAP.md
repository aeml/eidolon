# Eidolon Roadmap

> Project by [Robert Mendola](https://mendola.tech)
>
> Last refreshed: July 20, 2026

This is the root roadmap and planning source of truth for the repo. Per-patch history lives in `index.html` Patch Notes. Detailed working plans live under `docs/plans/` and should stay aligned with this file.

## Current Snapshot

- Current in-game displayed version: `Alpha 0.41.0.25`
- Active implementation line: `0.41` procedural dark-fantasy art migration
- Release-confidence gate: locked/self-hosted browser dependencies, production SHA/readiness reporting, and real-browser deployment QA are live-verified through release SHA `8b74226`
- Closed for planned implementation work: `0.21` through `0.37`
- Current shipped foundation: 4 classes, 4 realms, 4 dungeons, authoritative multiplayer combat, quests, loot, forge, stash, trading house, parties, social statuses, friends/presence, asset caching, audio foundation, accessibility baseline, reconnect/session resume, and substantial UX polish
- Biggest remaining alpha-wide risks: server/client monolith hotspots, missing guilds and PvP, persistence/economy hardening, and sustained multi-client soak validation

Evidence boundary for the current lane:

- Unit-tested and locally browser-tested work is not labeled live-tested.
- The Playwright harness covers anonymous, persistent-character, and two-account flows. The full character route passes locally against disposable Mongo/API containers and passed live against deployed SHA `8b74226` in hardware-accelerated system Chrome, including multiplayer convergence.
- Current hotspot measurements are `world.go` 8,578 LOC, `main.go` 5,027, `GameEngine.js` 5,810, and `UIManager.js` 3,634. The decomposition completion gates below are not met.

## Alpha 1.0 Strategy

The roadmap targets the last alpha build before beta. Two tracks run from here through `Alpha 1.0`:

- **Track A: Stability.** Reconnect, decomposition, persistence hardening, protocol safety, performance, multi-client harness, soak coverage.
- **Track B: Features.** Social depth, chat, economy, guilds, PvP, endgame content.

Track A leads. Track B follows. Both converge at `0.90` for pre-beta hardening.

## Final Product Vision

Eidolon should feel like a real online action RPG, not a promising prototype.

The end state is a polished browser MMO with:
- Fast, readable, satisfying combat
- Strong class fantasy across Fighter, Rogue, Wizard, and Cleric
- Dungeons that feel intentionally paced and replayable
- Loot and progression that support power, build expression, economy, and prestige
- Social systems strong enough to keep players engaged between runs
- A client/server architecture that remains debuggable and maintainable as content grows

When in doubt, optimize in this order:
- Gameplay feel
- Readability
- Maintainability
- Performance
- Content velocity

## Shipped Release Lines

For per-patch detail, see `index.html` Patch Notes. This summary captures the player-facing promise each closed line delivered.

- `0.22`: first-session onboarding, wayfinding, economy guidance, and dungeon route truthfulness
- `0.23`: class/spec fantasy, loot tooltip clarity, forge/gem/respec coherence, reward readability
- `0.24`: dungeon room-role pacing, Heroic/Mythic identity, rerun ladder, party-instance ownership clarity
- `0.25`: party reward visibility, trading house UX, daily/weekly retention loop, server-authoritative daily clock
- `0.26`: overworld self-movement correction smoothing without sacrificing server authority
- `0.27`: remote attack/cast/charge replication and de-echo, named ability callouts
- `0.28`: remote support-state visibility on a shared registry
- `0.29`: authoritative replication of full local self state, including regen, attributes, quests, runes, talents, buffs, and debuffs
- `0.30`: viewport clipping audit across Forge, support windows, service windows, and generated menus
- `0.31`: client UX consistency layer, shared chrome, viewport safety, scene-swap cleanup, UI render diffing
- `0.32`: audio foundation, audio detail control, authored-asset readiness, UI scale control, keybind clarity
- `0.33`: mesh catalog expansion, dungeon boss-approach pacing, repro sandbox QA tooling, difficulty-pacing metadata, room identity names
- `0.34`: social status foundation: Available, Looking for Party, In Run, Busy
- `0.35`: remote-actor interpolation frame-spike clamping for steadier nearby player presentation
- `0.36`: transient disconnects no longer drop the player to login; server-side session resume token, exponential-backoff client reconnect, connection-state HUD indicator
- `0.37`: party membership survives disconnects; `partyId` and `socialStatus` ride the state stream; party members highlighted; social status changes broadcast proactively; `busy` blocks invites; dungeon entry/return updates status automatically
- `0.38`: persistent friendships, friend request/accept/decline/remove, push-based online/offline presence, friends Social sub-panel, friend-online toast
- `0.39`: social/party/friend code extracted into server/client owner modules; dispatch switch thinned; `SocialPresenceController` extracted from `GameEngine`
- `0.40`: in progress; `0.40.0` extracted `server/internal/game/entity.go`, and `0.40.0.1` aligned ability/AoE presentation with authoritative gameplay while hardening movement and multiplayer synchronization

## Active Line: `0.40` To `0.43` Architecture Decomposition

Promise: make the codebase safe enough to support guilds, PvP, and endgame content without compounding monolith risk.

Planned work:
- Extract `entity`, `talents`, `runes`, `combos`, `setbonus`, `dungeon`, `combat`, and `actions` ownership from server `world.go`
- Introduce instance-scoped locks so `World.Mu` becomes a top-level invariants lock instead of a coarse simulation lock
- Extract client `RemoteEntityVisualSync` and `JumpController` from `GameEngine.js`
- Replace `TransientEffects` if/else ladder with a registry table
- Split `UIManager` into narrower panels/presenters while keeping it as a thin coordinator

Completion gates:
- `world.go` below 3,000 LOC
- `main.go` below 2,000 LOC
- `GameEngine.js` below 2,500 LOC
- `UIManager.js` below 1,500 LOC
- Per-instance simulation locking documented and tested
- Existing tests pass with new module-boundary coverage

## Roadmap To Alpha 1.0

### `0.44` To `0.47`: Persistence, Protocol, Perf, Multiplayer Coverage

Promise: every Track A foundation is hardened.

- Versioned schema migration tool
- Mongo indexes for auctions, friendships, and character lookup
- Repository pattern for character save/load
- Mongo integration test enabled in CI
- Formal message-handler registry with per-message-type rate limits
- Malformed-packet hardening and network framing/backpressure tests
- Multi-client load harness with scripted flows
- Go and JS hot-path benchmarks
- Nightly soak job
- Two-client multiplayer and reconnect integration tests

Completion gates:
- Reconnect, persistence, and economy flows survive deliberate failure testing
- Runtime risks are materially lower than they are today
- Track A is feature-complete enough for later v1.0 feature bands

### `0.50` To `0.59`: Expanded Multiplayer And Economy

Promise: multiplayer feels socially useful before guilds arrive.

- Structured chat channels: world, party, whisper, system
- Chat history replay on reconnect
- Whisper permissions and whisper-back convenience
- Ignore/block list using the relationship table
- Report queue moved from repo-root JSON files to Mongo/admin triage
- Party readiness, ready-check, role display, in-instance member health bars
- Loot rules: default free-for-all plus optional master loot
- Minimal direct player-to-player trade with both-confirm escrow
- Economy telemetry for gold sources/sinks
- Trading-house category filters

Completion gates:
- Chat can support guild chat as an additive layer
- Abuse-handling primitives exist before guild and PvP scope arrives
- Economy friction is lower for normal player behavior

### `0.60` To `0.69`: Guilds

Promise: guilds become a real social layer.

- Persistent `guilds` and `guild_members` collections
- Guild create/disband/invite/accept/leave/kick/promote/set-MOTD flows
- Guild roster panel
- Guild chat reusing the channel system
- Ranks and permissions: Leader, Officer, Member defaults
- Leadership transfer and inactive-leader handling
- Guild identity in chat/nameplate/social surfaces
- Guild bank with rank-bound permissions, shared stash/gold, and audit log
- `guild_id` on Entity state for remote-actor visualization
- Multi-client guild QA and soak coverage

Completion gates:
- Guilds are persistent and reliable
- Guild bank has an audit trail
- Guild presence works across instances

### `0.70` To `0.79`: PvP Foundation

Promise: PvP exists as a fair, readable, technically reliable mode.

- Faction/relationship resolver replaces hardcoded player-vs-player rejection
- PvP safe-zone concept distinct from movement safe zones
- Duel system: request/accept/cancel, duel ring, first-down loses, surrender
- PvP target readability: hostile target frames, nameplate colors, friendly-fire visualization
- Arena instance type: 1v1 first, 2v2 second
- Arena rewards with cosmetic-first bias
- PvP-specific balance scalars
- Queue-dodge and intentional-disconnect penalties
- Opt-in open-world PvP flagging
- Two-client PvP soak and regression coverage

Completion gates:
- Duels and at least 1v1 arena are playable and tuned
- Relationship resolver is the single combat-legality decision point
- Abuse vectors have explicit countermeasures

### `0.80` To `0.89`: Endgame, Content, And Maturity

Promise: late alpha has enough depth to feel like a real long-tail game and validates the decomposition with new content.

- 2v2 arena tuning and first arena season concept
- Guild-connected dungeon flow and guild-tagged dungeon leaderboards
- Max-level reinforcement through paragon-style sub-levels or cap-bound currency
- 5th dungeon to validate dungeon/content decomposition
- 5th class if the new dungeon validates cleanly
- Weekly raid concept: single boss, 5-10 players, weekly lockout
- Endgame combat readability pass
- Endgame economy tuning based on telemetry
- Endgame QA and regression coverage update

Completion gates:
- New content proves architecture decomposition worked
- Endgame loops are sticky enough to validate the v1.0 thesis

### `0.90` To `0.99`: Pre-Beta Hardening

Promise: the game is feature-complete enough that beta is about scale, balance, polish, operations, and content growth rather than missing foundations.

- Full progression audit from level 1 to cap
- Reconnect audit for every player-action message
- Economy abuse-case sweep: duplication, negative quantity, trading-house races, guild-bank races
- Client-trust and exploit hardening
- 100+ client, 24-hour soak with goroutine/memory checks
- Performance validation against baselines
- Alpha-wide polish across combat, UX, multiplayer, guilds, PvP
- Accessibility audit beyond the existing baseline
- Beta-gate review and final alpha closeout

Completion gates:
- Product is stable enough for broader beta usage
- Every Track A and Track B promise is verified end-to-end
- Known limitations are documented rather than hidden

## Cross-Cutting Tracks

- VFX and impact feedback: advance inside combat/presentation slices
- Audio expansion: add authored cues alongside combat, PvP, and UX work
- Accessibility: validate any UX-touching slice against readability/control needs
- Repro sandbox: extend whenever a manual QA gap is found
- Mesh and assets: continue moving content definitions into catalogs/registries opportunistically

## Alpha 1.0 Definition Of Done

Before calling the game `Alpha 1.0`, all of the following should be true:

- Full client works well across normal play
- Core gameplay feels smooth and readable
- Remote players show correctly and their major actions read smoothly on other clients
- Dungeons and endgame are replayable enough to hold attention
- Buildcraft and loot identity remain real strengths
- Social play is meaningful, not decorative
- Guilds exist and work reliably
- At least one PvP mode is genuinely playable
- Persistence, reconnect, and economy flows are trustworthy under deliberate failure testing
- Beta would mainly be about scale, balance, polish, operations, and content expansion

## Planning Discipline

- Update this file when the active release line or product scope changes materially
- Keep `docs/plans/` as detailed working plans, not competing root-level roadmaps
- Per-patch details belong in `index.html` Patch Notes only
- A slice does not ship until code, tests, patch notes, and the player-facing promise line up
- When this file and a deeper dated implementation plan disagree, update one or both immediately rather than letting drift persist

## Remaining Important Lore And Content Direction

The Aethelgard/Harmonizer/Umbra framing from earlier design docs remains canonical direction:
- Aethelgard is a reality shaped by collective consciousness
- The Umbra creates Dissonance that strips or corrupts forms
- The player restores regions by confronting Fallen Paragons and revealing their Eidolon state
- Loot and progression should read as restoring broken memories, not merely collecting stat sticks
- Low-detail/greybox art can be explained as the Primordial Layer where only raw geometry remains

This direction should guide future realm, dungeon, enemy, and loot-content passes, but current implementation priorities remain the roadmap above.

## License

This project is open source.
