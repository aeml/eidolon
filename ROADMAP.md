# Eidolon Roadmap

> Project by [Robert Mendola](https://mendola.tech)
>
> Current-status pointers refreshed: October 1, 2026

This is the product-level roadmap and historical Alpha 1.0 closeout record. The authoritative forward plan is [Alpha 1.11–1.99: playable beta to release readiness](docs/plans/2026-09-28-alpha1-11-to1-99-release-roadmap.md). Per-patch history lives in `index.html`; implementation and release evidence lives under `docs/`.

## Current Snapshot

- Working-candidate and verified-live versions are tracked separately in the [execution ledger](docs/plans/2026-09-05-roadmap-execution.md). The login screen shows its build's version; a locally prepared candidate is not automatically deployed.
- Accepted group clears cover all four elemental repair raids, Umbral Nexus and the Dark King, with the exact prepared-party/saved-continuation scopes in the release record. Earned Air/Tempest is also accepted. On September27 the user assigned uninterrupted campaign and pacing validation to their playtest; do not run another long automated campaign or mark those checks passed.
- Last accepted live release: `Alpha 1.58.0`, exact `f7518623bb5924625a918c8acdfe7ad890b0363a`, CI36808962117 passed all ten jobs. Independent public IPv4 checks confirmed both identities, database readiness and all four changed runtime assets. [Acceptance receipt](docs/plans/2026-10-01-release1-58-assets.json). Alpha 1.58.1 is the local level-up/Well Rested visual patch, awaiting publication and exact live verification; 1.59 moderation remains the next minor milestone. New Rogue, Cleric and Wizard model integration awaits their supplied files. Human pacing and the separate IPv6/DDNS configuration remain unverified.
- The shared Dark Realm and55-chapter campaign are deployed, including24 added chapters,38 discoveries and six optional conversational residents. Connected first-expedition and fresh-opening checks passed. The full campaign/raid/finale route and approximately100 hours to level100 plus8–12 hours in the Dark Realm remain for the user's playtest, not additional agent campaign automation. See the [campaign integration and remaining work](docs/plans/2026-09-21-campaign-pacing-and-dark-realm.md).
- The 1.10 candidate addresses early-story/regional XP gaps and unpayable late Forge potency costs while preserving saved contracts and gear. Its sequential forecast supports the 2–3-hour first-dungeon / roughly100-hour level-cap targets, not measured human completion. Late-game repeat-content pacing remains a playtest priority. Physical-phone dungeon/party feedback is user-deferred and nonblocking.
- Forward scope: [1.11–1.99 roadmap](docs/plans/2026-09-28-alpha1-11-to1-99-release-roadmap.md). Per the owner's latest decision,1.20/1.40 remain open-alpha quality milestones. Closed beta waits until the game is nearly complete, targeted for the1.90 readiness review after1.80 feature freeze; release readiness remains1.99. Existing accounts/characters stay; new beta players are invited, up to100 planned. Support uses in-game reports with an administrator-only JSON viewer. No automatic beta transition or unmeasured capacity promise. The [1.1–1.10 plan](docs/plans/2026-09-05-v1-1-to-v1-10-roadmap.md) remains the inherited scope.
- Physical resonance portal delivered in 1.12: Lanternhold (28, 235), east of the Dungeon Guide, with personal server-enforced eligibility. Guide entry remains compatible. Later population/atlas and beta gates remain open; a version number is not full roadmap completion.
- Phone UI work and the user's positive general-use feedback are retained. Actual dungeon/party phone feedback is user-deferred; further supported-device validation and launch support decisions are planned in 1.18, 1.47 and 1.95. See the [original mobile requirements](docs/plans/2026-09-05-v1-1-to-v1-10-roadmap.md#phone-playability-and-interface-redesign--11-through-13).
- The planned `0.50`, `0.60`, `0.70`, `0.80`, and `0.90` bands are implemented in the working tree
- Historical Alpha 1.0 architecture measurements: `world.go` 1,422 LOC, `main.go` 938, `GameEngine.js` 2,310, and `UIManager.js` 1,216 (not current measurements).
- Release identity is aligned across the browser, server health endpoint, container defaults, deploy scripts, isolated QA, and CI
- The user has authorized ongoing versioned deployment. Implementation, CI delivery and live verification remain separate states; a local candidate is not a deployed release.

## The Alpha 1.0 Player Promise

Alpha 1.0 is a complete browser action-RPG foundation rather than a vertical slice. It includes four classes and elemental regions, authoritative combat, persistent characters and social systems, dungeons and raids, a player economy, guilds, PvP, max-level progression, reconnect support, and a central story with a real endgame conclusion.

The Fourfold Chronicle is offered to every character by Archmage Ilyra, with explicit acceptance and completion conversations. The player learns that Orun, Neris, Pyralis, and Aeral shaped Earth, Water, Fire, and Air into a covenant that protects Eidolon. Malachar, the Dark King, destabilized their crystals so each realm would become dependent on his command.

The55-chapter campaign, including elemental investigations and the Dark Realm expedition, requires the player to:

1. Follow the first dissonant signal and recover invented, soulbound realm relics.
2. Clear the Earth, Water, Fire, and Air dungeons to defeat each corrupted outer guardian and reveal the separate road to that realm's crystal raid.
3. Complete Rootheart Sanctum, Tidestar Confluence, Ember Crown Crucible, and Skyglass Eyrie.
4. After each raid guardian falls, defend Artificer Maelin through a three-wave crystal-repair Vigil.
5. Reach level100, use the four repaired crystals to enter the Dark Realm, complete its expedition and lore, then clear the Umbral Nexus to reach the throne.
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

## Forward Roadmap: Alpha 1.11–1.99

Latest direction: current public availability remains **open alpha**. The next
target is a deliberately prepared **closed beta**, with modern dark-fantasy
character/equipment quality required before opening that cohort. Follow the
[visual contract](docs/art/2026-09-28-modern-arpg-closed-beta.md); the original
faceted-art finish is no longer the final target. No existing account access
or save policy changes automatically with this roadmap update.
The user supplies actor models only (player classes, monsters/bosses and NPCs).
Environment/equipment geometry, textures/materials, lighting, shaders, effects
and integration remain code-owned, as detailed in the visual contract.

The [populated-world and atlas contract](docs/plans/2026-09-28-world-population-and-atlas.md)
adds purposeful landmarks, roads, camps, ambient life, discoveries and working
optional activities, plus an accurate modern world map/minimap. First-pass
coverage is required before closed beta; later realm milestones refine it.
The [execution goal](goal.md) is to complete, test, publish and live-verify each
milestone in order, then continue; Luna monitors deployments.

The [complete release roadmap](docs/plans/2026-09-28-alpha1-11-to1-99-release-roadmap.md)
defines all 89 minor milestones, deliverables, evidence, dependencies, inherited
rules, decision points and beta/full-release gates. **1.32 is accepted live**
(CI36496302108, exact8a68685b); **1.33 is in local development**. Later milestones
remain planned, not delivered.

Owner-expanded 1.33 scope: [complete class-kit rework](docs/plans/2026-09-28-class-kit-rework.md)
for all twelve specializations, including single-branch combos. Wizard's two
non-Pyromancer branches and all Fighter branches lead the pass, followed by
Rogue and Cleric. Existing skill/talent selections and gear remain preserved;
respec-copy fixes alone cannot complete this milestone.

| Versions | Outcome |
| --- | --- |
| 1.11–1.20 | Improve the open-alpha foundation: portal, casino performance, early art/world/atlas, onboarding, support and safe operations. No beta opening. |
| 1.21–1.40 | Open-alpha campaign, encounter, class, loot, Forge and economy tuning. |
| 1.41–1.50 | Consistent character/equipment/world art, combat effects, audio, UI, accessibility and device performance. |
| 1.51–1.60 | Dependable community, guilds, recruitment, PvP/seasons, world events, moderation and endgame loops. |
| 1.61–1.70 | Complete casino experience, all game rules/settlements, cosmetic catalog, VIP lifecycle and strict EP/Gold separation. |
| 1.71–1.80 | Security, account recovery, valuable-operation safety, administration, privacy, persistence, hosting and capacity; feature freeze. |
| 1.81–1.90 | Recovery/rollback, incidents, support, documentation and a nearly complete closed-beta candidate with owner go/no-go. |
| 1.91–1.99 | Closed-beta feedback and candidate blockers; capacity/device/security/data signoff, launch rehearsal and a verified release-ready build. |

Beta/channel and full-release version labels require explicit gate approval, not
just a version bump. Payment integration remains excluded unless separately
authorized; a free launch is valid. Wipe policy, population/hosting budget,
device support and launch operations have owner decision points. Preserve saves
by default. Human campaign/pacing stays user-playtest-owned. Reuse accepted
evidence; do not run a full campaign/soak for every milestone. New classes,
continents and Jev bots are not automatic launch prerequisites.

### Inherited 1.10 foundation and evidence

The September 7 scope addition requires a
[progression/economy balancing pass and eight realm investigations](docs/plans/2026-09-07-progression-balance-and-investigations.md).
Reduced reward/drop budgets, the current XP curve, the expanded55-chapter
Chronicle and realm diary/discovery or magical-disturbance sites are delivered.
Earned regional continuations and all four elemental raid repair routes have
scoped acceptance; uninterrupted campaign/economy/pacing validation belongs to
the user's playtest. Follow the
[current integration audit](docs/plans/2026-09-14-final-integration-audit.md)
rather than treating the historical staging plan as unimplemented content.

The [1.1–1.10 plan](docs/plans/2026-09-05-v1-1-to-v1-10-roadmap.md) records the preceding foundation scope. Its dated release instructions are historical; newly confirmed blockers ship in an appropriate current corrective patch, not by restarting the 1.0.x sequence. The new forward roadmap inherits outstanding promises without reimplementing accepted work.

### Phone-first playability — a release requirement

The September 6 report identified a connected camera and interface problem:
zooming out enough to see the world makes characters tiny, while desktop-style
menus were difficult to use. The original milestone requirements below explain
the phone-specific redesign; use current evidence to distinguish delivered work
from remaining actual-device validation.

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
retain their evidence requirements. The user has confirmed general mobile UI
looks good and deferred dungeon/party feedback; neither erases implemented UI
work nor proves every device. The forward plan owns remaining support decisions.

## Supporting Documents

- [Engineering roadmap pointer](docs/ROADMAP.md)
- [Alpha 1.0 release-band closeout](docs/plans/2026-04-18-alpha-1-0-roadmap-and-status.md)
- [Alpha 1.0 implementation record](docs/plans/2026-05-03-v1-0-implementation-plan.md)
- [Protocol compatibility policy](docs/PROTOCOL.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Live browser QA checklist](docs/plans/live-browser-qa-checklist.md)

## License

This project is open source.
