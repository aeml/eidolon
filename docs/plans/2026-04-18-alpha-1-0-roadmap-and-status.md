# Eidolon Alpha 1.0 Roadmap And Status

Last refreshed: September 4, 2026

This document is the release-band closeout for the alpha-to-beta runway. The root `ROADMAP.md` is the product summary, `2026-05-03-v1-0-implementation-plan.md` is the engineering record, and `index.html` retains per-patch history.

## Current Snapshot

- Current in-game displayed version: `Alpha 1.0.23`
- Active implementation line: `Alpha 1.0`
- Status: release candidate implemented; local verification must stay green and production deployment remains operator-controlled
- Runtime hotspots: `world.go` 1,422 LOC, `main.go` 938, `GameEngine.js` 2,310, `UIManager.js` 1,216
- The central Fourfold Chronicle is a 15-chapter, automatically started campaign separate from the daily Quest Giver

## Foundation History

- `0.35` (closed): remote-player interpolation frame-spike protection
- `0.36` (closed): Reconnect and session resume with bounded server retention, client backoff, state restoration, and connection status
- `0.37` (closed): party persistence and proto integration; party/social identity survives reconnects and rides entity replication
- `0.38` (closed): Friends list and presence with durable relationships and push-based status
- `0.39` (closed): social closeout and initial server/client ownership extraction
- `0.40–0.43` (closed): architecture decomposition and instance-lock ownership
- `0.44–0.47` (closed): migrations, persistence repositories, protocol policy, load/benchmark tooling, and multiplayer regression coverage

## `.50` Band — Expanded Multiplayer And Economy (closed)

Delivered:

- World, party, guild, whisper, and system chat channels
- Reconnect history, reply convenience, message-rate policy, ignore, block, and Mongo reports
- Always-visible chat whose transcript is not dismissed by Escape
- Party roles, ready checks, health display, and FFA/master-loot choices
- Atomic direct trade with both-party confirmation and revision invalidation
- Economy source/sink metrics and trading-house filters

## `.60` Band — Guilds (closed)

Delivered:

- Persistent guild and membership models
- Create, invite, accept, leave, kick, promote/demote, MOTD, transfer, inactive-leader claim, and disband
- Guild chat and cross-instance presence
- Rank-bound item/gold bank with audit history
- Guild identity in entity replication, chat, social UI, and nameplates
- Guild-tagged dungeon leaderboards and multi-client coverage

## `.70` Band — PvP (closed)

Delivered:

- One combat relationship resolver and explicit PvP safe zones
- Duels, surrender, first-down outcomes, and no PvE loss
- Hostile/friendly readability for targets and nameplates
- 1v1 and 2v2 arena instances
- PvP balance scalars, cosmetic-first rewards, seasonal profiles, and leaderboards
- Queue/disconnect penalties and opt-in overworld flagging

## `.80` Band — Endgame, Content, And Maturity (closed)

Delivered:

- Level-100 Resonance ranks and three trait paths
- Umbral Nexus fifth dungeon
- Weekly 5–10-player Dark Realm raid with personal ISO-week rewards
- Four elemental crystal raids: Rootheart Sanctum, Tidestar Confluence, Ember Crown Crucible, and Skyglass Eyrie
- Full raid clear followed by Artificer Maelin's three-wave crystal-repair Vigil
- Malachar, the Dark King, with four dialogue/mechanical phases aided by Orun, Neris, Pyralis, and Aeral
- Endgame reward callouts, guild connections, and economy telemetry for later tuning

## `.90` Band — Pre-Beta Hardening (closed)

Delivered:

- Progression and persistence normalization
- Ordered Mongo migrations, indexes, repository mapping, and CI integration coverage
- Reconnect and dungeon crash-resume coverage, including restart of interrupted crystal Vigils
- Economy/exploit sweeps for auctions, direct trade, guild bank, raids, loot ownership, and dungeon lifecycle
- Handler registry, admission/rate policies, EDPB v2 framing, malformed-packet limits, and backpressure coverage
- Multi-client scenarios, Go/JS benchmarks, a 100-client 24-hour nightly soak definition, race testing, and real-browser release gates
- Alpha-wide accessibility, UI, combat feedback, and copy polish

## Fourfold Chronicle Content Gate

The story is part of Alpha 1.0, not deferred content:

1. The Bell That Rang Below introduces the four Eidolons and Malachar's dissonance.
2. Earth, Water, Fire, and Air each have a collectible lore relic and a realm-dungeon finale.
3. Each realm dungeon exposes, but does not replace, a separate raid road to that crystal.
4. The four raid chapters occur at the end of the elemental journey; the guardian must die and all three repair waves must be cleared for restoration credit.
5. All four repairs unlock the Umbral Nexus. Defeating the Eidolon Devourer stabilizes the Dark Realm portal.
6. Malachar's finale reveals his plan during four phases, with each elemental Eidolon supplying a distinct raid effect.

The Quest Giver remains outside the Ashen Smithy in full view and owns only repeatable daily contracts.

## Alpha 1.0 Verification Gate

Before a production release, all of these must pass on the exact candidate tree:

- Jest suite and lint
- Go unit/integration suite, race detector, vet, and build
- Mongo migration/repository integration
- Dependency audit
- Hot-path benchmarks and the bounded multi-client load scenario
- Anonymous and disposable-character Playwright routes, animation gallery, movement checks, and two-client scenarios where credentials are available
- Client/server release identity and deployed commit agreement

Passing local and CI checks does not itself deploy the game. Deployment and live persistent-character verification stay explicit operator actions.

## Beta Boundary

Alpha 1.0 closes the foundation. Beta priorities are concurrency scale, live balance, operations, moderation workflow, onboarding analytics, accessibility feedback, and sustained content cadence. New classes or large realm additions should follow evidence from live role composition and retention rather than being assumed Alpha blockers.
