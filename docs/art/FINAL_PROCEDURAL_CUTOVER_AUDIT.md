# Final Procedural Dark-Fantasy Cutover Audit

Audit date: September 3, 2026

Cutover release: `Alpha 0.41.0.33`

This is the closure ledger for the procedural redesign defined in `goal.md`. It records the production scope, the evidence that guards it, and the release conditions that must all pass on the same Git commit. A future content addition is incomplete until it extends the relevant manifest and passes the same gates.

## Final production scope

| Surface | Complete production inventory | Closure evidence |
| --- | --- | --- |
| Playable characters | Fighter, Rogue, Wizard, Cleric; distinct generated proportions, equipment fit, and Idle/Walk/Run/Attack/Death plus ability-specific movement | Procedural humanoid, animation-state, class matrix, equipment, local/remote, death, and gallery suites |
| Equipment and items | 36 equippable base families; 14 rendered positions; 18 rig attachment regions; 42 type/quality soulstones; Eidolon Heart and Shard; 80 intentional ground-drop identities | Server/client catalog equality, strict descriptor coverage, local/remote swap and removal, persistence round trips, icon and loot galleries |
| Actors | 47 current player, service, summon, overworld-enemy, and dungeon-boss archetypes, each routed to a named generated rig | Actor manifest/catalog equality, explicit factory routing, animation/bounds/pooling tests, complete High/Low actor galleries |
| Abilities and combat presentation | 52 selectable abilities, 60 rune variants, 12 server-created projectile/trap/zone subtypes plus the documented compatibility zone, four local area fields, 23 attached conditions, 10 collision-capable impacts, and 16 damage/heal reactions | Server-source-derived manifests, exact radius/arc checks, local/remote cast matrices, projectile authority, status lifecycle, impact and feedback galleries |
| Overworld | Gloamwood Marches, Lanternhold, Moonfrost Expanse, Cinder Wastes, Stormcrown Reach | Distinct generated surfaces, foliage, architecture, props, actors, atmosphere, fixed navigation geometry, and High/Low realm galleries |
| Dungeons | Thorncrypt, Furnace Below, Shattered Aerie, Drowned Sanctum, including every room role, boss family, objective state, reward seal, exit portal, and boss danger field | Layout and progression tests, four-theme interior/entrance/encounter galleries, entry/exit browser route, death/reconnect/state restoration coverage |
| Environmental hazards | 12 sandstorms, 15 lightning zones, 19 lava pools, and 19 wind gusts at all 65 canonical server anchors | Exact broadcast identity/radius tests, inclusive edge and lifecycle tests, whole-catalog High/Low gallery, and real four-realm damage pilgrimage |
| UI and delivery | Generated ability/item/soulstone/currency icons, code-driven login atmosphere, inline favicon, payload-free asset packs, versioned service worker | Procedural icon manifests, asset/cache/version suites, zero-authored-raster and zero-authored-model ratchets, anonymous browser request audit |

## Art and readability contract

`DARK_FANTASY_ART_BIBLE.md` is the visual source of truth. The final runtime uses one restrained faceted language while keeping regional identity explicit:

- Gloamwood: grave-loam, root scars, cairns, moss, sickly gravewind, ossuary silhouettes.
- Lanternhold: vigil cobbles, oath-iron, amber lanterns, reliquaries, readable service symbols and safe paths.
- Moonfrost: drowned basalt, rime fractures, pale choir forms, cold conduction warnings.
- Cinder Wastes: ash, blackglass, furnace faults, kiln armor, ember and lava danger language.
- Stormcrown: conductor-cut slate, storm metal, pressure rings, wind direction and lightning language.
- Thorncrypt: living roots, rusted vows, briar crowns, sealed crypt rooms.
- Furnace Below: oath-anvils, chimneys, chains, obsidian bulwarks, safe-floor contrast.
- Shattered Aerie: broken sky architecture, razor vanes, thunder bells, pressure and convergence motifs.
- Drowned Sanctum: abyssal stone, coral crowns, anchor relics, black tide and pearl signals.

Fixed gameplay boundaries never breathe, pulse, or scale. Motion belongs to interior ornament only. Low quality removes optional segments and particles while preserving silhouette, warning state, duration, direction, and exact gameplay footprint.

## Legacy cutover

- Production preload and background model lists are empty.
- Production asset packs contain no downloadable authored payload.
- No authored character, enemy, equipment, prop, environment, icon, or texture path is referenced by runtime modules, manifests, HTML, or the service worker.
- Authored model payload is zero bytes and authored raster payload is zero files under the production asset tree.
- The only runtime `.glb` token is the static server MIME declaration. Three 155–157 byte plant compatibility sentinels are geometry-free generated JSON, have no runtime reference, and are excluded explicitly from the authored-payload metric.
- Unknown actor types and malformed procedural shapes fail closed; they cannot silently become a generic production fallback.
- Superseded authored files remain recoverable through Git history and are not part of the deployed runtime dependency graph.

The ratchet lives in `tests/ProceduralArtMigrationGuard.test.js`; asset catalog, pack, cache, page-runtime, and loader tests protect the surrounding delivery paths.

## Synchronization and lifecycle audit

| Boundary | Required behavior and evidence |
| --- | --- |
| Local movement | Real mouse input covers exact arrival, sub-arrival, near travel, sustained travel, camera coherence, sequence acknowledgement, and bounded correction without frame-spike overshoot |
| Remote movement | Two clients cover ordered snapshots, interpolation, facing, ground convergence, jumps, combat animation, and frame-spike clamping |
| Equipment | Every replicated slot and item identity attaches, replaces, and clears without requiring movement; local and remote characters share the same descriptor |
| Abilities | Base and rune casts preserve canonical identity, source, target, direction, radius, arc, active layer, and persistent duration locally and remotely |
| Reconnect and late join | Session resume restores character, equipment, quests, animation state, instance, and eligible persistent effects without duplicating visuals |
| Death and respawn | Movement/cast/charge state, effects, targets, hazard exposure, and scene artifacts clear; authoritative respawn returns a fresh stable state |
| Realm and dungeon transfer | Old pending entities and hazards cannot materialize in the new scene; room state, portals, objectives, and current-instance effects rebuild once |
| Hazard continuity | Fractional exposure clears on leaving a field, town safety, death, respawn, recall, disconnect, removal, replacement, and world/instance transfer |

## Automated release matrix

The merge/deploy workflow must succeed as one chain:

1. ESLint with zero warnings, npm dependency audit, all Jest suites with coverage.
2. All Go packages with coverage, the Go race detector, and a clean server build.
3. Anonymous Playwright smoke against the prepared static client.
4. Hardware-accelerated High/Low animation and visual galleries.
5. Disposable isolated character gameplay, movement, all four class/rune matrices, death/respawn, and two-client remote animation.
6. Server and Pages deployment from the exact workflow SHA.
7. Frontend manifest, frontend runtime query, and backend health identity agreement on that SHA.
8. Live anonymous, persistent-character, quest, menus, movement, combat/loot, four-realm hazard pilgrimage, dungeon/persistence, four-class, and multiplayer QA.
9. Sanitized browser evidence upload.

The final workflow is a hard gate: a failed test, race, build, identity poll, browser assertion, credential scan, or evidence sanitization leaves the cutover incomplete.

## Real hazard pilgrimage

`/qa-hazard <earth|water|fire|air|town>` exists only for authenticated usernames in `EIDOLON_QA_USERNAMES`. It accepts no coordinates and resolves only these fixed server-owned anchors:

| Route | Canonical entity | Center | Radius |
| --- | --- | ---: | ---: |
| earth | `hazard-sandstorm-0` | (-800, -450) | 10 |
| water | `hazard-lightning-0` | (-50, -750) | 7 |
| fire | `hazard-lava-0` | (-1150, 100) | 6 |
| air | `hazard-wind-0` | (1150, 100) | 6 |
| town | Lanternhold return | (-1.25, 200) | safe |

Each danger route begins at full health, keeps unrelated hostile damage blocked, pauses health regeneration, and permits normal authoritative environmental damage for 45 seconds. Browser QA checks that the named hazard exists exactly once in the client's interest-managed scene, all of its meshes are scene-owned, its boundary and gameplay metadata match the authoritative radius within rendering precision, and a matching damage event arrives for the local character. Server catalog tests and the whole-atlas gallery separately verify all 65 anchors together. The town route clears inspection state and proves that hazard damage stops.

## Production completion rule

The redesign is complete only when the final `0.41.0.33` commit is on `master`, `origin/master` and the working tree agree, the complete workflow above passes, and both production identity endpoints report that exact commit and version. Operational proof is retained by the GitHub Actions run and the live browser evidence artifact; the repository records the durable scope and gates without baking a soon-stale commit hash into source.
