# Eidolon Roadmap

> Project by [Robert Mendola](https://mendola.tech)
>
> Last refreshed: September 6, 2026

This is the product-level roadmap and Alpha 1.0 closeout record. Per-patch history lives in `index.html`; implementation and release evidence lives under `docs/`.

## Current Snapshot

- Current in-game displayed version: `Alpha 1.0.22` (candidate; deployment tracked separately)
- Active implementation line: `Alpha 1.0` closeout and beta-readiness verification
- Proposed next releases: [1.1–1.10 roadmap](docs/plans/2026-09-05-v1-1-to-v1-10-roadmap.md). Dungeon return-to-town, boss targeting, abilities, hallway generation, and overlapping-floor reports reopen dungeon reliability as an immediate release gate. Ship confirmed progression blockers in `1.0.x`; all five repair gates must pass before `1.1` closes. Investigation and verification status is tracked in the [execution ledger](docs/plans/2026-09-05-roadmap-execution.md); individual fixes do not establish full dungeon reliability.
- Phone playability is also a release priority: a useful default camera, readable characters/text, and touch-first menus must replace the need to zoom out a desktop-sized interface. Basic usability is required for `1.1`; the complete phone HUD/menu redesign belongs in `1.2`, with touch-combat and performance tuning in `1.3`. See the [mobile redesign and acceptance gates](docs/plans/2026-09-05-v1-1-to-v1-10-roadmap.md#phone-playability-and-interface-redesign--11-through-13).
- The planned `0.50`, `0.60`, `0.70`, `0.80`, and `0.90` bands are implemented in the working tree
- Current architecture measurements: `world.go` 1,422 LOC, `main.go` 938, `GameEngine.js` 2,310, and `UIManager.js` 1,216
- Release identity is aligned across the browser, server health endpoint, container defaults, deploy scripts, isolated QA, and CI
- Production deployment remains a separate operator action; Alpha status here means the release candidate is implemented and locally verified, not that an uncommitted tree was deployed

## The Alpha 1.0 Player Promise

Alpha 1.0 is a complete browser action-RPG foundation rather than a vertical slice. It includes four classes and elemental regions, authoritative combat, persistent characters and social systems, dungeons and raids, a player economy, guilds, PvP, max-level progression, reconnect support, and a central story with a real endgame conclusion.

The Fourfold Chronicle is offered to every character by Archmage Ilyra, with explicit acceptance and completion conversations. The player learns that Orun, Neris, Pyralis, and Aeral shaped Earth, Water, Fire, and Air into a covenant that protects Eidolon. Malachar, the Dark King, destabilized their crystals so each realm would become dependent on his command.

The 15-chapter campaign requires the player to:

1. Follow the first dissonant signal and recover invented, soulbound realm relics.
2. Clear the Earth, Water, Fire, and Air dungeons to defeat each corrupted outer guardian and reveal the separate road to that realm's crystal raid.
3. Complete Rootheart Sanctum, Tidestar Confluence, Ember Crown Crucible, and Skyglass Eyrie.
4. After each raid guardian falls, defend Artificer Maelin through a three-wave crystal-repair Vigil.
5. Use the four restored crystals' resonance to expose the Umbral Nexus and stabilize the Dark Realm portal.
6. Fight Malachar through four phases in which Orun, Neris, Pyralis, and Aeral each provide a distinct combat intervention.

Daily quests remain separate repeatable contracts offered by the visible Quest Giver outside the Ashen Smithy.

## Completed Release Bands

### `.50` — Multiplayer And Economy

Outcome: multiplayer is socially useful and ordinary exchange is trustworthy.

- Structured world, party, guild, whisper, and system chat with history and reply support
- Ignore/block controls and a Mongo-backed report queue
- Permanent chat presentation: Escape releases focus and closes other windows without hiding the transcript
- Party roles, ready checks, nearby health visibility, and configurable loot rules
- Atomic both-confirm direct trade with server-owned escrow
- Economy source/sink telemetry and trading-house category filters

### `.60` — Guilds

Outcome: guilds are persistent institutions, not decorative labels.

- Create, invite, accept, leave, kick, rank, MOTD, transfer, inactive-leader recovery, and disband flows
- Leader, Officer, and Member permissions
- Cross-instance guild chat and presence
- Shared item/gold bank with permission checks and an audit trail
- Guild identity in replication, chat, social surfaces, and remote nameplates
- Guild-tagged dungeon leaderboards

### `.70` — PvP

Outcome: PvP is a fair, readable, server-authoritative game mode.

- Central relationship resolver and PvP-safe-zone rules
- Duels with request, accept, cancel, surrender, first-down resolution, and no PvE loss
- Hostile/friendly target and nameplate presentation
- 1v1 and 2v2 arena instances with context-specific balance scalars
- Seasonal profiles, cosmetic-first rewards, leaderboards, and disconnect penalties
- Opt-in overworld PvP flagging

### `.80` — Endgame And Content

Outcome: level cap has a repeatable long-tail and the architecture supports new content.

- Resonance ranks and trait spending after level 100
- The Umbral Nexus as a fifth dungeon
- Weekly 5–10-player Dark Realm raid, personal lockout, and reward path
- Four elemental crystal raids with full assault routes and defended repair finales
- Four-phase Dark King fight with narrative dialogue and Eidolon mechanics
- Guild dungeon connections, seasonal PvP, reward readability, and economy tuning surfaces

### `.90` — Pre-Beta Hardening

Outcome: known alpha risks have explicit guards and repeatable evidence.

- Ordered Mongo migrations, required indexes, and repository-owned character mapping
- Dungeon room crash restoration and reconnect/session resume
- Registered message handlers with admission policies and per-message rate limits
- EDPB wire version 2, malformed-frame limits, backpressure tests, and protocol documentation
- Auction, direct-trade, guild-bank, progression, raid-reward, and dungeon re-entry exploit coverage
- Multi-client load scenarios, Go/JS benchmarks, nightly 100-client 24-hour soak workflow, race tests, and browser E2E gates
- Accessibility audit and UI/control polish

## Alpha 1.0 Definition Of Done

The Alpha 1.0 candidate is expected to satisfy these gates:

- The Fourfold Chronicle is offered through Ilyra, explicitly accepted and completed, persisted, readable in the Journal, and gated through all four dungeons, four raids, four repair Vigils, the Umbral Nexus, and the Dark King
- Core gameplay and remote actions are readable across normal multiplayer play
- Dungeons, elemental raids, PvP, guild activity, Resonance progression, and the weekly raid provide repeatable loops
- Social play includes durable friends, parties, guilds, chat, moderation controls, and direct trade
- Persistence, reconnect, economy, and instance restoration survive deliberate failure tests
- Architecture hotspots remain below `world.go` 3,000, `main.go` 2,000, `GameEngine.js` 2,500, and `UIManager.js` 1,500 LOC
- The full client and Go test suites, lint, build, race detector, Mongo integration tests, benchmarks, load checks, and browser smoke routes pass
- Beta work can focus on scale, tuning, operations, polish, and content growth instead of missing foundations

## Next: Beta

The [1.1–1.10 plan](docs/plans/2026-09-05-v1-1-to-v1-10-roadmap.md) proposes the alpha-to-beta sequence. Immediate dungeon defects take priority in `1.0.x` hotfixes and must be closed before `1.1`; `1.6` is reserved for encounter improvements, not repairs to unplayable basics. Historical foundation closeout does not override newly reported failures. Later milestones cover visual and combat polish, story depth, progression, competitive PvP, social activity, world events, and measured beta readiness. A fifth class and major realm expansion remain outside this scope.

### Phone-first playability — a release requirement

The September 6 report identifies a connected camera and interface problem:
zooming out enough to see the world makes characters tiny, while desktop-style
menus remain difficult to use. The planned solution is a phone-specific layout,
not further shrinking the desktop screen.

- **1.1: make ordinary play usable.** Frame the camera around the visible play
  area, keep the hero and threats readable at the default zoom, simplify the HUD,
  and make essential menus and two-thumb controls work in portrait and landscape.
- **1.2: finish the redesign.** Use readable full-screen panels or bottom sheets,
  large item rows, explicit actions, consistent Back/Close navigation, safe-area
  spacing, and independently adjustable UI scale. Keep chat available without
  letting it cover combat; preserve desktop controls.
- **1.3: refine the feel.** Tune touch targeting, aiming, telegraphs, effects and
  sustained device performance. Carry phone usability through subsequent releases.

Success means normal play without maximum zoom-out, browser zoom, or forced
rotation; readable text and separated touch targets; and verified town, combat,
inventory, quest and dungeon flows on actual iOS and Android phones. The detailed
[mobile acceptance gates](docs/plans/2026-09-05-v1-1-to-v1-10-roadmap.md#phone-playability-and-interface-redesign--11-through-13)
remain open until that evidence exists. This is planned scope, not a claim that
the redesign is already complete.

## Supporting Documents

- [Engineering roadmap pointer](docs/ROADMAP.md)
- [Alpha 1.0 release-band closeout](docs/plans/2026-04-18-alpha-1-0-roadmap-and-status.md)
- [Alpha 1.0 implementation record](docs/plans/2026-05-03-v1-0-implementation-plan.md)
- [Protocol compatibility policy](docs/PROTOCOL.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Live browser QA checklist](docs/plans/live-browser-qa-checklist.md)

## License

This project is open source.
