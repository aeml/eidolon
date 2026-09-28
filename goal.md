# Eidolon roadmap execution goal — Alpha 1.11 through 1.99

**Current checkpoint (supersedes chronological notes below):** Alpha1.15.0 is
accepted live at156345544c699514d4f430b7fc6275e8f31df497, CI36424283224.
Luna confirmed all gates; root independently verified public IPv4 exact identity,
healthy database, login/notes and16 assets.1.16 Water/Fire population and session
recovery is being prepared for publication; see [its receipt](docs/plans/2026-09-28-release1-16.md).
Next: finish proportionate1.16 checks, publish, Luna terminal monitoring and exact
live acceptance; then1.17. Global roadmap and final art/beta gates remain open.

Current instruction, September 28, 2026: work through the
[authoritative roadmap](docs/plans/2026-09-28-alpha1-11-to1-99-release-roadmap.md)
version by version. Finish each milestone's necessary implementation, verify it
proportionately, publish synchronized version/patch notes, commit/push, monitor
deployment, confirm the exact live build and changed behavior, then continue to
the next milestone. A completed patch or deployment is not the terminal goal.

Required additions include the [populated world and atlas overhaul](docs/plans/2026-09-28-world-population-and-atlas.md)
and [modern ARPG visual contract](docs/art/2026-09-28-modern-arpg-closed-beta.md).
The first populated-world/map pass is required before closed beta, not deferred
to late polish. User-provided actor models are a dependency; environments,
equipment, materials, shaders and integration remain implementation-owned.

Previous checkpoint: [1.13.0 is accepted live](docs/plans/2026-09-28-release1-13.md),
exact SHA 730987e3ce7b7eb55bc5c55a6a44ca06a8927f2a, CI36403511513 successful,
including live QA and independent public IPv4 identity/assets verification.
1.14 atlas/feedback is implementing from its
[source preflight](docs/plans/2026-09-28-1-14-preflight.md).
Its [implementation receipt](docs/plans/2026-09-28-release1-14.md) records the
tested report acknowledgement/privacy work, shared geography, and overworld
location search/details/waypoints and cached overworld cartography with inspected
desktop/phone-sized captures, including a reproduced/fixed Canvas2D tile failure.
Real interior/PvP maps and journal-tracked quests/saved discovery overlays now
pass focused unit/browser checks, including desktop/phone-sized resize recovery,
manual turn-in states and character/instance privacy. Final integrated atlas/report
routes and native browser touch gestures passed; service/facing consistency is
implemented. Initial Alpha1.14.0 candidate8098796179ffd5faab250e7a3a04766343f6a1ab
failed CI36415402488 on two stale Jest fixtures. Those fixtures are corrected;
44 focused checks pass and runtime behavior is unchanged. Corrected candidate
0dc2f055180e219c45afddec7e56e7f1210a630d is pushed; replacement CI36416114631
is in progress with its full client gate green, Luna monitoring. Next: complete
mandatory deployment gates and independent exact live verification. Local1.15
preparation now includes shared Earth compositions/lore and physical path ribbons
with matching atlas centerlines;32 focused checks pass. Its
[implementation receipt](docs/plans/2026-09-28-release1-15.md) lists remaining
scenery, interactions, onboarding and review. Do not publish1.15 before1.14 is
accepted and the whole1.15 milestone is ready. No partial milestone deployed.
The global goal and later gates are still open.

Superseding checkpoint: **1.14.0 accepted live**, corrected commit
0dc2f055180e219c45afddec7e56e7f1210a630d, CI36416114631 fully successful.
Luna confirmed terminal success/live identity. Independent IPv4 verification
confirmed frontend/backend version and SHA, health/database, login/cumulative
notes and11 exact deployed source assets. IPv6 remains owner-deferred.
**1.15 implementing locally:** Earth scenery/paths, shared spawn solids and
optional read-only lore interaction, shared public atlas/radar markers and
corrected first-session/class/recovery guidance. Desktop/phone-sized atlas and
guidance checks pass. See its receipt for actual checks and the
remaining acceptance work. The two communal courtyards now have shared map
destinations, checked character clearance, local reduced-motion-aware animation
and owned-resource cleanup. Production-renderer scene checks cover all eight
Earth sites and both courts at desktop-high and phone-sized-low settings; actual
tablet occlusion found in that check is fixed in world/server/map data together.
Still required: bounded fresh-session/travel verification, populated-scene cost
acceptance and remaining ambient-town review, then the complete1.15 release.
Superseding checkpoint:1.15.0 candidate is ready for publication. Working
residents, bounded fresh opening/diary progression and hardware scene checks
pass; version/login/backend defaults and cumulative notes are synchronized.
See the release receipt for exact scopes and the mixed-client fresh-route caveat.
Candidate `c776113011047e12fc80fd82f5a754a02aa40d1e` is pushed;
CI36423730242 is in progress, Luna monitoring. Next: required CI/deploy/live QA,
independent exact acceptance, then1.16. The1.16 source preflight is local only.
Correction: that CI failed on missing generated administrator landing geometry.
The40 new solids are now included, with before/after server safety coverage.
The corrected1.15 candidate must pass a replacement CI before live acceptance.
Corrected SHA156345544c699514d4f430b7fc6275e8f31df497 is pushed;
replacement CI36424283224 is Luna's active watch.1.16 recovery work is local
and uncommitted while that gate runs: usable login after failed resume, retired
connection isolation, blocked-storage and stale-load recovery.40 unit checks
and two bootstrap/browser scenarios pass; full1.16 account/world scope remains
open in [its receipt](docs/plans/2026-09-28-release1-16.md). Do not accidentally
include these partial1.16 changes in a further1.15 correction push.
1.14 remains the last verified live release until those gates pass.

Use Luna for CI/deployment and long dungeon/raid monitoring, with terminal-only
reports. Keep focused checks and mandatory CI; reuse unaffected evidence. Do not
restart long campaign/soak runs: campaign/pacing remains user-playtest-owned.
Preserve player data, authority and Gold/EP isolation. Do not activate payments,
wipe characters, buy services or change launch/access policies without approval.

Terminal condition: the roadmap's mandatory scope and release gates are met,
the approved 1.99 release-ready candidate is live and verified, and its evidence,
limitations and operations handoff are recorded. Owner-only beta/launch decisions
remain genuine gates; do not invent approval to keep moving. Continue until this
outcome, an explicit pause or a material dependency requiring user direction.

This file records the execution contract, not the goal controller's runtime
status. If that controller is paused, only the user's Resume control can restore
automatic continuation; never claim a documentation edit resumed it.

## Historical procedural visual migration contract

The following original goal is retained for context. The current roadmap and
September 28 ownership/quality requirements above supersede conflicting original
procedural-only restrictions and its narrower terminal condition.

September 28 direction update: the original migration contract below is retained
as history and architecture guidance. The user now requests modern Diablo/Path
of Exile-like dark-fantasy presentation and better character/equipment quality
before closed beta. Follow the [new visual contract](docs/art/2026-09-28-modern-arpg-closed-beta.md):
the faceted-only finish is superseded, and an authored-model pilot can be
evaluated before any explicitly approved production dependency change. Preserve
the existing gameplay, rig, save and ownership contracts. Historical migration
completion is not completion of the new visual target.

Fully redesign Eidolon's visual presentation into a cohesive, polished, code-generated dark-fantasy art style. Replace the existing authored 3D models throughout the production game with procedural geometry, code-driven rigs and animation, generated materials, shaders, particles, icons, and effects.

Complete this as a safe multi-patch migration. Continue autonomously from patch to patch; do not stop after planning, prototypes, individual classes, partial coverage, commits, pushes, or intermediate deployments. The terminal condition is the complete code-generated visual system running successfully in production.

You are explicitly authorized to modify the game, create tests and tooling, commit scoped changes, push them to `master`, trigger deployments, monitor release workflows, test the live game, and fix regressions discovered. Preserve player data, save compatibility, gameplay balance, networking behavior, authoritative ability radii, and existing user progress.

## Art direction

- Establish and document a recognizable, cool, stylized dark-fantasy art bible for Eidolon.
- Favor strong silhouettes, sculpted and faceted forms, readable proportions, restrained materials, atmospheric lighting, smooth motion, and distinct class, realm, rarity, and faction palettes.
- Avoid generic placeholder primitives, programmer-art results, excessive visual noise, incoherent asset mixtures, or a toy-like appearance.
- Ensure characters, enemies, equipment, environments, abilities, hazards, interactables, loot, and UI feel like parts of the same game.
- Maintain clear combat readability at the normal gameplay camera distance.
- Ability and hazard visuals and telegraphs must exactly communicate their authoritative effect radius, shape, duration, direction, timing, and danger.
- Give every overworld area, realm, settlement, dungeon, and encounter family its own memorable theme while retaining the shared Eidolon visual language.
- Use lighting, palette, architecture, terrain forms, foliage, particles, weather, props, enemies, hazards, ambient effects, and sound hooks to distinguish each area cleanly.

## Procedural visual architecture

- Create cached geometry, material, palette, rig, animation, attachment, icon, environment, hazard, and effect factories.
- Generate visual assets once and reuse them; never rebuild expensive geometry every frame.
- Support quality levels, shadows, instancing, pooling, disposal, scene residency, chunk loading, and performance-safe fallbacks.
- Use programmatic geometry, code-driven animation, shaders, particles, `CanvasTexture`, SVG, and CSS where appropriate.
- The final production runtime must not depend on the existing authored character, enemy, equipment, prop, or environment model files.
- Preserve old assets through Git history during migration, but remove them from production manifests, preload lists, service-worker caches, bundles, and runtime references after replacements are verified.

## Characters and equipment

- Build a shared procedural humanoid rig and proportion system with distinct Fighter, Rogue, Wizard, and Cleric silhouettes.
- Give every class appropriate body geometry, face and head treatment, stance, locomotion, attacks, casts, impacts, deaths, jumps, emotes, and class-specific animations.
- Support remote-player animation and equipment replication correctly.
- Implement standardized attachment and layering for every equipment slot, including head, shoulders, chest, hands, waist, legs, feet, neck, back, main hand, off hand, shields, and every other slot in the item schema.
- Make every equippable item visibly represented on local and remote characters.
- Give every item ID an intentional visual descriptor. Shared item families are acceptable, but rarity, tier, realm, material, and named-item distinctions must remain visibly meaningful.
- Handle body intersections, armor layering, weapon grips, sheathing, dual wielding, shields, spellcasting, class proportions, and equipment swaps cleanly.
- Generate consistent inventory, equipment, loot, vendor, stash, auction, and ground-drop presentation for every item category.
- Add automated coverage checks that fail when a new item or equipment slot lacks a visual definition.

## World, areas, and actors

- Replace all enemies, bosses, NPCs, summons, pets, quest givers, vendors, interactables, dungeon objects, buildings, foliage, terrain dressing, portals, loot objects, and important props with the new code-generated style.
- Preserve collision boundaries, hitboxes, navigation, spawn positions, target selection, animation state, entity identity, and multiplayer synchronization.
- Give each enemy family and boss a readable silhouette and attack language while maintaining faction and regional consistency.
- Redesign every overworld realm, town, dungeon, room family, and transition without compromising navigation or gameplay geometry.
- Audit every existing area individually. Identify all damaging ground effects, environmental damage volumes, traps, projectiles, status zones, dungeon mechanics, portals, blockers, collision shapes, safe zones, spawn rules, and scripted encounter effects.
- Give each hazard an unambiguous themed warning, active state, exact gameplay footprint, timing cue, impact response, and cleanup behavior.
- Verify area hazards at boundaries, after death and respawn, during realm and dungeon transitions, after reconnect, and when chunks or rooms unload and reload.
- Ensure every region feels finished rather than sparsely decorated, while keeping navigation, enemies, loot, quest targets, and important interactables easy to read.

## Abilities and effects

- Pass every class ability, enemy ability, projectile, aura, summon, status effect, environmental hazard, damage volume, and dungeon mechanic through the new visual system.
- Ensure visual radii and shapes match server-authoritative gameplay values exactly.
- Correctly render local, remote, boosted, upgraded, interrupted, expired, death-cleared, and reconnect-restored states.
- Pool and dispose transient effects safely.
- Add manifest tests proving that every ability, hazard, and effect route has a production visual implementation.

## Migration process

1. Audit all current models, textures, icons, item IDs, slots, classes, actors, abilities, effects, environments, animations, hazards, preload paths, and runtime references.
2. Record performance, visual, memory, network, frame-pacing, and gameplay baselines.
3. Create the art bible, procedural foundations, visual manifests, coverage tooling, and screenshot and animation galleries.
4. Deliver a production-quality vertical slice for one class with complete equipment, combat effects, enemies, NPCs, hazards, and one representative environment.
5. Validate the slice in real gameplay, refine it until it is clearly production quality, and then expand the architecture across the entire game.
6. Migrate all remaining classes, equipment, items, actors, environments, dungeons, hazards, abilities, effects, UI presentation, and multiplayer visuals.
7. Remove all production dependencies on legacy authored models only after complete replacement coverage is proven.
8. Perform a final full-game consistency, performance, accessibility, animation, synchronization, lifecycle, and zone-mechanics audit.
9. Update the version and cumulative patch notes throughout the migration so each deployed patch clearly describes its completed visual work.
10. Complete the final production cutover and verify both frontend and backend release identities.

## Patch discipline

- Work in reviewable, coherent patches and commits.
- Keep the live game playable throughout the migration, using feature flags or compatibility layers when necessary.
- After each meaningful patch, run proportionate unit, integration, browser, multiplayer, visual-gallery, performance, and server tests.
- Push verified patches to `master` and monitor the complete deployment workflow.
- If a deployed patch exposes a regression, diagnose it, fix it, redeploy it, and continue.
- Do not silently weaken tests, remove gameplay coverage, hide missing visual mappings behind generic fallbacks, or declare incomplete categories out of scope.
- Do not change combat balance, item statistics, economy values, progression, quest state, or player data merely to simplify the visual migration.
- Keep controls responsive, motion smooth, menus clean, effects readable, and frame pacing stable on both high and low quality settings.

## Required automated coverage

- Every class and animation state.
- Every item ID and equipment slot.
- Every enemy, boss, NPC, summon, pet, and interactable type.
- Every ability, projectile, aura, telegraph, environmental hazard, damaging area, and status effect.
- Every realm, town, dungeon, room family, transition, and major environmental object.
- Equipment appearance for local and remote players.
- Login, reconnect, respawn, realm transitions, dungeon transitions, equipment swapping, death cleanup, and state restoration.
- Exact visual-to-authoritative AOE and hazard-footprint agreement.
- Asset loading, service-worker behavior, disposal, scene residency, memory stability, frame pacing, and representative low and high quality performance.
- Screenshot galleries or equivalent inspectable evidence for all major visual families and area themes.

## Completion criteria

Do not mark this goal complete until all of the following are true:

- The production game uses the final code-generated dark-fantasy visual style everywhere in scope.
- Every area has a cohesive, polished, distinct theme and every existing area mechanic and damage effect has been audited and represented accurately.
- All playable classes, equipment slots, equippable items, actors, environments, abilities, hazards, and effects have intentional implementations.
- Every equipped item is visible correctly on local and remote characters.
- No legacy authored model remains referenced by production code, manifests, preload paths, service workers, or deployed bundles.
- Full client and server suites, race detection, lint, builds, browser tests, isolated-character tests, movement tests, multiplayer tests, animation galleries, visual coverage checks, and performance checks pass.
- The game is visually polished, clean, readable, responsive, and smooth in representative real gameplay on low and high settings.
- The final commit is pushed to `master`.
- Frontend and backend production endpoints report that exact commit and version.
- Live anonymous, persistent-character, four-class, equipment, quest, combat, reconnect, area-hazard, dungeon, and multiplayer QA pass against production.
- The repository is clean and synchronized with `origin/master`.
- Final patch notes summarize the complete visual migration.

When blocked, exhaust safe in-scope investigation and alternatives. Ask for user input only when completion genuinely requires a new artistic decision, authority, credential, or external-state change that cannot be reasonably inferred. Otherwise continue making, testing, deploying, and improving patches until every completion criterion is satisfied.
