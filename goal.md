# Eidolon Procedural Dark-Fantasy Visual Redesign Goal

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
