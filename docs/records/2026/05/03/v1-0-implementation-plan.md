# Eidolon Alpha 1.0 Implementation Record

Original plan: May 3, 2026
Closeout refresh: September 4, 2026
Release candidate: `Alpha 1.0.0`

This document records how the audited Alpha 1.0 gaps were closed. It is an implementation record, not a claim that an uncommitted local tree has been deployed. The exact release candidate still passes through CI, deployment identity checks, and live browser QA.

## 1. Architecture And Ownership

The four measured orchestration hotspots are below their original gates:

| Owner | Alpha baseline | Alpha 1.0 candidate | Gate |
|---|---:|---:|---:|
| `server/internal/game/world.go` | 8,578 | 1,422 | < 3,000 |
| `server/main.go` | 5,027 | 938 | < 2,000 |
| `src/core/GameEngine.js` | 5,810 | 2,306 | < 2,500 |
| `src/ui/UIManager.js` | 3,634 | 1,203 | < 1,500 |

Game systems now live in narrow files for combat, progression, entity lifecycle, dungeons, persistence, direct trade, PvP, guild banking, quests, and endgame. Server messages use a registered handler map with explicit admission and rate policies. Client runtime, movement, entity synchronization, network-message presentation, and UI panels have separate owners.

The lock hierarchy is documented in `server/internal/game/LOCKING.md`; dungeon instances own their progression state independently of the top-level world invariants lock.

## 2. Persistence And Protocol

- Seven ordered Mongo migrations establish users, characters, auctions, relationships, reports, guilds, PvP, raids, and the required indexes.
- Character BSON mapping is repository-owned and round-trips extended quest lore, party/guild state, Resonance, and dungeon resume data.
- Mongo integration tests run against a service container in CI.
- Dungeon layouts and room progress persist for crash restoration.
- State replication uses the versioned EDPB v2 envelope, including wide level-cap XP fields and guild/party identity.
- Framing, malformed payloads, message admission, per-type rate limits, and outbound backpressure have regression coverage.
- Compatibility policy is documented in `docs/PROTOCOL.md`.

## 3. Multiplayer, Social, And Economy

- Session resume keeps an authoritative entity available during the reconnect window; the client uses exponential backoff and restores state without a page reload.
- Structured chat supports world, party, guild, whisper, and system channels, with history replay, reply, ignore, block, and reporting.
- Chat is a permanent HUD surface. Escape may blur its input and close other overlays but cannot dismiss the transcript.
- Parties support persistent membership, roles, readiness, health presentation, and loot policy.
- Direct trade is an atomic server-owned exchange: any offer mutation invalidates confirmations and settlement validates both inventories and gold balances together.
- Auction delivery and seller payout use independently idempotent claims.
- Economy telemetry measures authoritative gold sources and sinks.

## 4. Guilds

- Persistent guild and membership collections
- Create/invite/respond/leave/kick/rank/MOTD/transfer/inactive-leader/disband governance
- Leader, Officer, and Member permission model
- Cross-instance guild chat and presence
- Shared item/gold bank with permission checks, serialized mutation, and audit history
- Guild identity replicated into chat, social surfaces, and nameplates
- Guild-tagged dungeon leaderboards

## 5. PvP

- Central combat relationship resolver and explicit safe-zone policy
- Duel request, acceptance, cancellation, surrender, and first-down lifecycle
- 1v1 and 2v2 arena instances
- PvP-specific damage scaling and readable hostile/friendly presentation
- Cosmetic-first rewards, seasonal profiles, records, and leaderboards
- Queue dodge and disconnect penalties
- Opt-in overworld PvP flag

## 6. Endgame

- Level-100 Resonance progression with power, ward, and fortune traits
- Umbral Nexus fifth dungeon
- Weekly 5–10-player Dark Realm raid with personal ISO-week lockout
- Four elemental raids, each distinct from its realm dungeon
- Four-phase Dark King encounter with material Eidolon interventions
- Guild dungeon completion reporting and endgame reward presentation

## 7. The Fourfold Chronicle

The main quest is deliberately separate from daily quests and starts automatically on character entry. Its authoritative catalog contains 15 ordered chapters with title, narrative description, lore, category, chapter number, and explicit objective text. Existing characters are reconciled to canonical metadata without losing progress.

Campaign sequence:

1. `The Bell That Rang Below` — discover dissonance among the risen dead.
2. Recover Verdant Memory Seeds, then clear Verdant Bastion Catacombs and Hollow Sentinel to reveal Rootheart Sanctum.
3. Recover Moon-Tide Pearls, then clear the Abyssal Well and Thalorath to reveal Tidestar Confluence.
4. Recover Cinderheart Ore, then clear the Molten Core and Lord Infernax to reveal Ember Crown Crucible.
5. Recover Stormglass Pinions, then clear Tempest Spire and Zephyrion to reveal Skyglass Eyrie.
6. Clear all four elemental raids in sequence. Each guardian death starts a three-wave repair Vigil around Artificer Maelin; restoration credit is awarded only after the full defense.
7. With four restored crystals, clear the Umbral Nexus and Eidolon Devourer to stabilize the portal.
8. Enter the Dark Realm and defeat Malachar through Earth, Water, Fire, and Air phases.

Collection relics are owner-only, soulbound, consumed by their Chronicle objective, and rejected by vendor, direct-trade, and auction paths. Dungeon and raid access checks are server-authoritative for every party member. Interrupted repair Vigils restart from a complete three-wave defense when a restored cleared instance is re-entered.

## 8. Release Hardening

- Progression bounds and state normalization
- Auction, direct-trade, guild-bank, weekly-reward, loot-owner, dungeon-reentry, and raid-completion exploit tests
- Go race detector and vet
- Go and JS hot-path benchmarks
- Scripted multi-client load driver
- Nightly 100-client, 24-hour soak workflow with health thresholds
- Anonymous, isolated-character, movement, animation, and multiplayer browser suites
- Accessibility checks and keyboard/control regressions
- Exact client/server version and commit identity gates

## 9. Definition Of Done

Alpha 1.0 is ready to hand to the release pipeline when:

- all automated unit, integration, lint, race, build, audit, benchmark, load, and browser gates pass;
- the Chronicle can progress from its automatic first chapter through four dungeon unlocks, four repair raids, the portal, and Malachar;
- persistence and reconnect tests retain quest, social, inventory, economy, and instance state;
- release manifests agree on `Alpha 1.0.0` and the exact candidate commit;
- remaining limitations are beta-scale or balance work, not missing Alpha foundations.

The pipeline, production deploy, and live persistent-character verification remain required operational steps after the local candidate is committed.
