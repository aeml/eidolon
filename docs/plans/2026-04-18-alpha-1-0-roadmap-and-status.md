# Eidolon Alpha 1.0 Roadmap and Status

Last refreshed: April 18, 2026

Purpose: keep one working document that answers three questions clearly.

1. Where are we right now?
2. What still remains in `0.22`?
3. What is the roadmap from `0.23` through `alpha 1.0`?

This doc is the practical tracking layer for the current alpha-to-beta runway. It should stay aligned with `index.html`, `README.md`, `ROADMAP.md`, `docs/ROADMAP.md`, and the dated release-plan docs under `docs/plans/`.

## Current snapshot

- Current in-game displayed version: `Alpha 0.33.4`
- `0.21` is closed out and accepted
- `0.22` is closed for planned implementation work after shipping meaningful onboarding, wayfinding, economy-guidance, and dungeon-guidance improvements
- The game already has a large playable alpha foundation: 4 classes, 4 realms, 4 dungeons, authoritative multiplayer combat, quests, loot, forge, stash, trading house, parties, asset caching, and substantial UX polish
- The biggest remaining alpha-wide risks are multiplayer smoothness, remote-action replication quality, server/client architectural concentration, missing social depth, missing guilds, and missing PvP

## Where we are now

### Shipped through `0.33.4`

- `0.22.0`: first-session onboarding and start-screen clarity
- `0.22.1`: starter-town wayfinding and service prompts
- `0.22.2`: first-step copy consistency and quest-funnel clarity
- `0.22.3`: starter-route map priority and visual ordering
- `0.22.4`: canonical town-service labels and exact marker anchors
- `0.22.5`: Dungeon Guide wayfinding and first-dungeon handoff
- `0.22.6`: Trading House and Vendor guidance split
- `0.22.7`: economy onboarding guidance for what to sell where
- `0.22.8`: live boss state truth across route surfaces
- `0.22.9`: sharper shrine/chest route guidance
- `0.22.10`: truthful dungeon entrance hints while moving
- `0.22.11`: ambush objectives keep pressure-spike language
- `0.22.12`: transitional route beats read like real approach states
- `0.22.13`: cleared dungeons read like extraction instead of fake turn-in
- `0.22.14`: pre-fight boss objectives tell the player to commit before the encounter goes live
- `0.22.15`: starter loot, forge-material, and town-service guidance better explain what to vendor, what to keep, and what belongs in the Forge
- `0.22.16`: failed combat attempts, level-up milestones, and reward moments now explain themselves more clearly in live play
- `0.22.17`: nearby remote-player actions and damage now read better in crowded multiplayer combat
- `0.22.18`: nearby remote-player jumps and basic attacks now read more clearly, with named action labels that are easier to parse in motion
- `0.22.19`: first-hour milestone and unlock guidance is now easier to recover from the start flow and in-client Help screen
- `0.22.20`: post-level-30 and post-level-100 town states now point players toward the right next loop instead of going quiet
- `0.22.21`: release-review pass marks `0.22` feature-complete in code and limits further `0.22` work to live-QA findings only
- `0.23.0`: class-select and skill-tree presentation now do a better job of selling class fantasy and branch-role identity
- `0.23.1`: branch cards now explain each spec's role, preferred loop, and strength profile more clearly
- `0.23.2`: inventory tooltips now give faster keep/equip/compare guidance so loot decisions read more clearly at a glance
- `0.23.3`: forge upgrade, socket, gem, and respec surfaces now explain buildcraft order and material commitments more clearly
- `0.23.4`: dungeon reward messaging now lands more like payoff and closes the `0.23` line with stronger release-readability polish
- `0.24.0`: dungeon room state now exposes canonical room roles and pacing metadata across journal, portal, minimap, and world-map route surfaces
- `0.24.1`: longer dungeon runs now repeat reward and ambush beats more deliberately while preserving the late shrine reset before boss pressure
- `0.24.2`: Heroic and Mythic boss clears now advertise and award distinct endgame bonus drops, making endgame difficulty identity visible in both the dungeon menu and live reward summaries
- `0.24.3`: the Dungeon Guide now surfaces a live rerun ladder from accepted daily dungeon boss quests, making the max-level reward ladder visible before a run starts
- `0.24.4`: the Dungeon Guide now makes party-instance ownership, continue/reset control, and empty-instance expiry explicit before the group commits to a run
- `0.25.0`: the party panel and invite prompt now make cooperative value more explicit by surfacing party reward-sharing, role visibility, and the nearby party bonus in player-facing UI
- `0.25.1`: the Trading House now better explains browse timing, listing intent, and collection outcomes so auction flow is easier to read without guessing
- `0.25.2`: the Quest Journal now surfaces the highest-value daily ladder so repeatable return goals stay visible even before quests are accepted
- `0.25.3`: the Quest Journal and HUD clock now run off authoritative server time so daily reset messaging stays truthful and live-ops timing is easier to reason about
- `0.25.4`: the Help screen and release docs now close out the real daily return loop with a player-facing reference and a dedicated retention QA route
- `0.26.0`: large self movement corrections in the overworld now preserve server authority while smoothing the local mesh and locked camera instead of hard-snapping the whole view
- `0.27.0`: remote basic attacks now replicate as explicit attack-start events so nearby clients can rotate and animate remote melee intent immediately instead of waiting for delayed side effects
- `0.27.1`: remote ability casts now face their accepted cast target immediately on nearby clients so spell intent reads correctly before later state packets catch up
- `0.27.2`: remote charge-state actors now keep charge-style movement presentation instead of falling back to a generic attack loop while the server drives the rush
- `0.27.3`: remote actors now leave attack presentation as soon as authoritative recovery states arrive, reducing stuck-swing reads after server-side combat resolution
- `0.27.4`: duplicate remote attack confirmations now stop overextending the same swing, so explicit attack events and later replicated attack state no longer stack extra pose time onto one melee action
- `0.27.5`: explicit remote action-start messages can now refresh a new nearby swing or cast even while duplicate generic attack-state confirmations remain idempotent
- `0.27.6`: named remote ability callouts now suppress the immediate generic attack-label echo, keeping nearby spell readability focused on the real skill instead of stacking a second generic label
- `0.27.7`: remote damage confirmations no longer re-arm nearby remote attack presentation unless the local player is the victim and the client still needs a fallback hit-read sync
- `0.27.8`: repeated explicit remote ability starts now keep suppressing generic attack-label echo even while the named callout itself is still rate-limited, keeping rapid repeat casts readable without stray fallback labels
- `0.27.9`: named remote action de-echo now lasts for the full 750ms callout throttle window, closing the last late-window leak where repeat casts could still surface a stray generic attack label
- `0.28.0`: nearby remote Spirit Guardians state now produces support readability on activation and expiry, starting a broader multiplayer presentation pass that covers persistent support states as well as attacks and casts
- `0.28.1`: Guardian Embrace now replicates through the hot-path state path and surfaces nearby `EMBRACE UP/DOWN` readability, extending multiplayer support-state visibility beyond Spirit Guardians
- `0.28.2`: Blessing of Resolve now replicates through the hot-path state path and surfaces nearby `RESOLVE UP/DOWN` readability, continuing the support-state visibility pass with another real server-timed buff
- `0.28.3`: remote support-state activation readability now de-dupes against each buff's own explicit cast label, reducing duplicate support callouts and starting to consolidate shared support-state timing rules
- `0.28.4`: Divine Intervention now replicates through the hot-path state path and surfaces nearby `INTERVENTION UP/DOWN` readability, extending the support-state visibility pass to another real server-timed rescue buff
- `0.28.5`: remote support-state readability now runs through a shared registry for labels, colors, and cast de-dupe mapping, consolidating the growing 0.28 support-state line onto one reusable path
- `0.28.6`: Arcane Shield now replicates through the hot-path state path with remaining shield value and surfaces nearby `SHIELD UP/DOWN` readability, extending the support-state pass to HP-backed protective buffs
- `0.28.7`: Time Warp now replicates through the hot-path state path and surfaces nearby `WARP UP/DOWN` readability, extending the support-state visibility pass to wizard haste windows as well as protective buffs
- `0.28.8`: Spell Focus now replicates through the hot-path state path and surfaces nearby `FOCUS UP/DOWN` readability, extending the support-state pass to charged-cast setup buffs as well as timed utility windows
- `0.29.0`: remote support/control buffs now sync through a shared effect registry, consolidating the growing set of server-authoritative remote buff mappings before further multiplayer readability slices expand it again
- `0.29.1`: the local authoritative player buff path now reuses the same shared effect sync helper, reducing local-vs-remote drift in server-driven buff expiry and consumption handling
- `0.29.2`: Spirit Guardians now also syncs through the shared support-effect helper, narrowing synced guardian teardown so it no longer routes through broader cleric ability cancellation
- `0.29.3`: Spirit Guardians now also participates in the server delta snapshot change tracker, making guardian-only activation and expiry reliable in compressed authoritative state broadcasts
- `0.29.4`: boosted Spirit Guardians now also participates in both server delta tracking and the client-side shared support sync helper, keeping the boosted guardian variant authoritative after compressed updates
- `0.29.5`: local authoritative self sync now also applies server-sent HP and mana regeneration values, keeping passive sustain behavior aligned with authoritative derived stats after full and delta updates
- `0.29.6`: local authoritative self sync now also applies server-sent base attributes, keeping the character sheet's base-versus-bonus stat breakdown aligned with authoritative server changes
- `0.29.7`: local authoritative self sync now also applies server-sent cast speed, closing another emitted-but-not-applied derived stat gap in the local player path
- `0.29.8`: local authoritative self sync now also applies quest data from entity state and delta payloads, keeping quest objectives and journal state aligned with authoritative player sync
- `0.29.9`: local authoritative self sync now also applies server-sent scale through the normal setScale path, keeping player size aligned with authoritative server changes
- `0.29.10`: local authoritative self sync now also applies server-sent charge state, keeping local charging behavior aligned with the same authoritative flag already used by remote entity sync
- `0.29.11`: local authoritative self sync now also applies server-sent skill rune selections during delta updates, keeping local rune-driven progression state aligned with authoritative player sync
- `0.29.12`: local authoritative self sync now also stores server-sent unlocked talent lists during delta updates, keeping local talent progression state aligned with authoritative player sync
- `0.29.13`: local authoritative self sync now also clears stale debuff timers and stacks when authoritative status booleans explicitly say those debuffs are no longer active
- `0.29.14`: server delta snapshots now also track debuff booleans, keeping status-only transitions from being skipped by compressed authoritative state updates
- `0.29.15`: authoritative state now also replicates slow factor, keeping active slow strength truthful in local sync and debuff UI without inventing generic debuff durations
- `0.29.16`: authoritative state now also replicates root duration, keeping active root remaining time truthful in local sync and debuff UI without widening the rest of debuff-duration replication yet
- `0.29.17`: authoritative state now also replicates stun duration, keeping active stun remaining time truthful in local sync and debuff UI without widening the rest of debuff-duration replication yet
- `0.29.18`: authoritative state now also replicates bleed duration, keeping active bleed remaining time truthful in local sync and debuff UI without widening the rest of debuff-duration replication yet
- `0.29.19`: authoritative state now also replicates poison duration, keeping active poison remaining time truthful in local sync and debuff UI without widening the rest of debuff-duration replication yet
- `0.29.20`: authoritative state now also replicates bleed damage, keeping active bleed tick detail truthful in local sync and debuff UI without inventing server-side stack counts
- `0.29.21`: authoritative state now also replicates poison damage, keeping active poison tick detail truthful in local sync and debuff UI without inventing server-side stack counts
- `0.29.22`: authoritative state now also replicates slow duration, keeping active slow remaining time truthful in local sync and debuff UI instead of relying on a local placeholder timer
- `0.29.23`: authoritative state now also replicates weak point active state, keeping local self sync and debuff UI aligned with the real server-owned marked flag before adding duration detail
- `0.29.24`: authoritative state now also replicates weak point duration, keeping active weak point remaining time truthful in local sync and debuff UI instead of relying on a local placeholder timer
- `0.29.25`: authoritative state now also replicates mark weakness active state, keeping local self sync and debuff UI aligned with the real server-owned marked flag before adding duration detail or factor detail
- `0.29.26`: authoritative state now also replicates mark weakness duration, keeping active marked remaining time truthful in local sync and debuff UI instead of relying on a local placeholder timer
- `0.29.27`: authoritative state now also replicates spirit duration, keeping active Spirit Guardians remaining time truthful in local self sync and buff UI instead of relying on a local placeholder timer
- `0.29.28`: authoritative state now also replicates blessing resolve duration, keeping active Blessing of Resolve remaining time truthful in local self sync and buff UI instead of relying on a local placeholder timer
- `0.29.29`: authoritative state now also replicates time warp duration, keeping active Time Warp remaining time truthful in local self sync and buff UI instead of relying on a local placeholder timer
- `0.29.30`: authoritative state now also replicates guardian embrace duration, keeping active Guardian Embrace remaining time truthful in local self sync and buff UI instead of relying on a local placeholder timer
- `0.29.31`: authoritative state now also replicates arcane shield duration, keeping active Arcane Shield remaining time truthful in local self sync and buff UI instead of relying on a borrowed placeholder timer
- `0.29.32`: authoritative state now also replicates divine intervention duration, keeping active Divine Intervention remaining time truthful in local self sync and buff UI instead of relying on a missing local timer
- `0.29.33`: authoritative state now also replicates spell focus duration, keeping active Spell Focus remaining time truthful in local self sync and buff UI instead of relying on a missing local timer
- `0.29.34`: authoritative state now also replicates swift active state and duration, keeping active Swift remaining time truthful in local self sync and buff UI instead of relying only on local trigger guesses
- `0.30.0`: Forge tabs now use a larger viewport-capped menu with internal scrolling so bottom upgrade and action controls stay visible and clickable during normal play
- `0.30.1`: Help, Report, and Patch Notes now cap to the viewport and keep tall content scrollable inside the menu frame
- `0.30.2`: Merchant, Stash, Trading House, Available Quests, and Quest Journal windows now cap to the viewport and keep growing content scrollable inside their menu frames
- `0.30.3`: Abilities, Inventory, Character Sheet, and Split Stack windows now cap to the viewport and keep growing utility content scrollable inside their frames
- `0.30.4`: generated Dungeon Portal and Talent Master menus, Skill Tree, party roster, and party invite surfaces now cap to the viewport and keep footer/actions reachable
- `0.31.0`: the client UX consistency line begins by moving generated Dungeon Portal and Talent Master chrome onto shared generated-menu, backdrop, select, choice-row, and action-row classes
- `0.31.1`: generated Dungeon Portal and Talent Master shell styles now live in shared CSS instead of duplicated inline JavaScript style assignments
- `0.31.2`: the pause menu now uses reusable viewport-safe pause menu classes with an internally scrollable action stack
- `0.31.3`: Settings, Help, Report, and Patch Notes now share reusable support-window shell and scroll-body classes
- `0.31.4`: Settings, Help, and Report support-menu footers/actions now use shared support footer, action-row, and button modifier classes
- `0.31.5`: core Settings controls now use reusable support-field classes for rows, labels, hints, values, select controls, and range inputs
- `0.31.6`: Settings asset-cache panel now uses reusable asset-cache panel, meter, pack, badge, metadata, action-row, and cache button variant classes
- `0.31.7`: Patch Notes release entries now use reusable patch-note entry, title, and list classes instead of repeated inline content chrome
- `0.31.8`: Report form select and textarea controls now reuse support-field control classes instead of duplicated inline form chrome
- `0.31.9`: Pause menu report and respawn actions now use reusable pause-menu warning and danger button variants instead of inline color styles
- `0.31.10`: Help screen guide sections now use reusable help-guide section, title, separator, and highlighted key classes
- `0.31.11`: Patch Notes header helper text and commit-history link now use reusable patch-notes header classes instead of inline chrome
- `0.31.12`: Start screen version label and Patch Notes shortcut now use reusable start-version-row classes instead of inline chrome
- `0.31.13`: Start screen First Steps panel shell, body, title, copy, and steps now use reusable start-flow-panel classes instead of inline chrome
- `0.31.14`: Start screen auth title, action row, fill buttons, status text, and enter-world controls now use reusable classes instead of inline chrome
- `0.31.15`: Start screen class-selection title and class fantasy descriptions now use reusable title, description, and class-color modifier classes instead of inline chrome
- `0.31.16`: Loading overlay shell, title, progress frame, progress fill, and status text now use reusable loading-screen classes instead of inline chrome
- `0.31.17`: Compact ability tooltip name, description, and mana-cost rows now use reusable ability-tooltip classes instead of inline chrome
- `0.31.18`: Abilities spellbook shell and spell grid layout now use reusable abilities-menu and abilities-content classes instead of inline chrome
- `0.31.19`: Skill Tree empty-state placeholder copy now uses a reusable skill-tree-empty-state class instead of inline chrome
- `0.31.20`: Inventory footer row, sort action, gold display, and starter guidance now use reusable inventory classes instead of inline chrome
- `0.31.21`: Split Stack dialog shell, content, amount controls, item label, and actions now use reusable split-stack classes instead of inline chrome
- `0.31.22`: Merchant shop shell, content panes, guidance copy, mystery-box grid, and buyback grid now use reusable shop classes instead of inline chrome
- `0.31.23`: Merchant Common, Uncommon, and Rare sell-all buttons now use reusable shop sell-button classes instead of inline chrome
- `0.31.24`: Stash window shell, 10-column stash grid, and stash guidance copy now use reusable stash classes instead of inline chrome
- `0.31.25`: Forge shell centering, viewport sizing, tall menu height, z-index, and flex layout now use the reusable forge-window class instead of inline chrome
- `0.31.26`: Scene transitions now separate persistent and per-instance environment content so dungeon and town rebuilds clear generated environment meshes cleanly
- `0.31.27`: Instance environment cleanup now disposes generated mesh resources while preserving persistent world surfaces
- `0.31.28`: Instance transitions now reset render-update signatures for HUD, XP, hotbar, enemy bars, character sheet, and world-map updates
- `0.31.29`: Player stat HUD updates now diff inside UIManager so repeated identical HP, mana, ability, cooldown, and cost payloads skip redundant DOM writes
- `0.31.30`: XP bar updates now diff inside UIManager so stable level and progression payloads stop rewriting the bar every frame
- `0.31.31`: Hotbar cooldown rendering now diffs inside UIManager so stable cooldown overlays avoid redundant DOM writes
- `0.31.32`: Character sheet refreshes now diff inside UIManager so repeated identical visible character payloads skip full stats and equipment-slot rebuilds
- `0.31.33`: Hotbar slot assignment now invalidates cooldown diffing so recreated cooldown overlay DOM refreshes safely
- `0.31.34`: Opening the character sheet now invalidates its diff cache so each open cycle forces one fresh visible render
- `0.31.35`: Scene swaps now clear UIManager display caches alongside render signatures before the next scene presents
- `0.31.36`: Render throttling now reuses the UIManager hotbar cooldown serializer so engine and UI comparisons stay aligned
- `0.31.37`: Render throttling now reuses the UIManager character sheet serializer so visible character payload comparisons stay aligned
- `0.31.38`: Render throttling now reuses the UIManager player stat serializer so displayed HUD payload comparisons stay aligned
- `0.31.39`: Render throttling now reuses the UIManager XP serializer so progression comparisons stay aligned between engine and UI
- `0.31.40`: Primary menus, service windows, support modals, and the world map now use shared viewport-safe layout rules with wide-screen Inventory companions and narrow-screen non-overlap behavior
- `0.31.41`: Death and respawn overlay chrome now uses reusable class-based CSS and shared button styling, closing the planned `0.31` client-UX consistency line before the `0.32` audio foundation begins
- `0.32.0`: The audio foundation is live with a shared client AudioManager, generated placeholder cues for UI, loot, combat, and jumps, and persisted settings controls for audio enablement and volume
- `0.32.1`: Audio Detail settings now let players reduce routine UI cue noise while preserving gameplay feedback sounds through the shared AudioManager path
- `0.32.2`: Audio cue asset metadata and optional authored-media playback now make generated UI, loot, combat, and jump cues replaceable through the shared AudioManager without scattering playback calls
- `0.32.3`: UI Scale settings now persist an 85%-125% menu and HUD text scaling control through the shared UI layer while preserving viewport-safe window bounds
- `0.32.4`: Control Hint settings now let players expand Help with a detailed keyboard reference without changing actual input mappings
- `0.33.0`: Procedural Fire, Air, and Water realm enemy silhouettes now live in MeshCatalog while MeshFactory keeps equivalent runtime output, cached geometry/material handling, hitboxes, and skeleton fallback behavior
- `0.33.1`: Dungeon room summaries now mark boss-approach pacing metadata, letting objectives, Journal, dungeon entrance hints, minimap, world map, and combat callouts identify the final pre-boss commit beat without changing rewards, unlocks, or boss progression
- `0.33.2`: The repro sandbox now includes deterministic dungeon room previews and a documented smoke workflow for rendering, movement, VFX, menu chrome, and boss-approach pacing checks without booting normal login or live gameplay
- `0.33.3`: Dungeon room summaries now carry difficulty, run-level, and difficulty-pacing metadata so Heroic and Mythic routes read as distinct pressure states, while remote-player jump visuals use the same jump animation lifecycle and between-packet progress smoothing as local jumps
- `0.33.4`: Dungeon room summaries now expose room-identity metadata and route surfaces use clearer names like Treasure Cache, Restorative Shrine, Ambush Chamber, Boss Approach, and Boss Lair without changing rewards or room completion rules

### What `0.22` has clearly accomplished already

- The first-session path is much more explicit than it was before `0.22`
- Start-screen copy, objective text, hover hints, world map, minimap, and journal are much closer to telling the same story
- Early town services and dungeon entry points are much easier to find
- Starter economy guidance is materially better
- Dungeon route language is significantly more truthful and authored-feeling

### What is still not at alpha 1.0 quality yet

- Multiplayer remote-player smoothness is not yet at the bar for a pre-beta build
- Overworld movement authority is still weaker than it should be
- Remote jumps, attacks, buffs, telegraphs, and other action states still need cleaner replication and sequencing
- Social systems are still mostly parties plus basic chat plus trading house, not full social depth
- Guilds do not exist yet
- PvP does not exist as a real shipped mode yet
- Audio, accessibility, and some presentation depth still lag behind the rest of the product

## `0.22` remaining work

`0.22` should still be treated as the new-player-loop and readability release. It should not turn into guilds, PvP, or endgame sprawl.

### `0.22` objective status

#### Objective A: First-session onboarding flow

Done:

- [x] Cleaner start-screen guidance exists
- [x] First-session class-pick and town-entry copy is stronger
- [x] First-destination guidance toward Quest Giver and Forge is stronger
- [x] First-dungeon handoff is much clearer

Still remains:

- [ ] Full fresh-account review from register to first dungeon-ready milestone
- [x] Cleaner recovery when a player closes UI and loses the funnel
- [x] Better explanation of what level milestones unlock next
- [ ] Better first-hour validation on live browser QA instead of only patch-by-patch tuning

#### Objective B: Moment-to-moment combat readability

Done:

- [x] Stronger telegraph and route-callout baseline already exists
- [x] Buff/debuff grouping and combat-intent work from recent releases are already in place
- [x] Some dungeon combat guidance now reads much more truthfully

Still remains:

- [x] Clearer out-of-range, blocked, and failed-interaction messaging in normal play
- [x] Stronger level-up, unlock, and reward feedback during the first hour
- [x] Better visibility of combat outcomes in crowded multiplayer situations
- [x] A deliberate pass on remote-player readability so other players' actions are easier to parse

#### Objective C: Guidance and wayfinding

Done:

- [x] Map, minimap, hover hints, objective tracker, and journal are much more aligned than before
- [x] Town-service anchors and labels are more canonical
- [x] Dungeon route guidance is much more truthful and paced

Still remains:

- [ ] Final live QA pass to confirm the first-hour route never becomes ambiguous
- [x] Better fallback guidance after unusual state changes, recall, death, or returning to town mid-funnel
- [x] Better guidance for what to do after the first dungeon path is understood

#### Objective D: Starter progression clarity

Done:

- [x] Basic economy guidance around Vendor / Repair, Stash, and Trading House is stronger
- [x] Auto-loot, loot feedback, and inventory UX already have a decent baseline from earlier patches
- [x] Clearer early explanation of item rarity and what counts as junk versus worth keeping
- [x] Clearer explanation of forge, gems, and upgrade expectations for new players
- [x] Better explanation of early material and gold value
- [x] Better tooltips/help text for starter buildcraft systems

Still remains:

- [ ] Validate the new loot and forge explanations in a first-hour live QA pass

### `0.22` release gates still to satisfy

- [ ] Fresh-login through first meaningful dungeon-ready milestone feels coherent end to end
- [ ] New players can recover their next step without guessing or leaving the client
- [ ] Early combat and interaction feedback feels readable under real play
- [ ] Early loot, materials, and item decisions are understandable
- [ ] A targeted first-hour live QA pass is completed and written down
- [x] A version review decides whether `0.22` is actually done or still needs another slice

### `0.22` release review

Current decision:

- `0.22` is feature-complete in code for its intended scope
- no additional planned `0.22.x` implementation slices should be added unless live QA finds a real issue
- the remaining blocker to closing `0.22` is live first-hour QA sign-off, not missing onboarding/readability systems

Historical closeout note:

- the first-hour live QA route from `docs/plans/2026-04-18-0-22-first-hour-closeout.md` remains useful as a regression checklist
- `0.22` is no longer the active implementation line

Current status:

- `0.22` is closed for planned implementation work
- `0.33.4` is now the active version line
- `0.31` is closed for planned client-UX consistency work
- `0.32` has shipped its audio foundation, audio detail control, authored-asset readiness, UI scale control, and keybind clarity setting
- `0.33.0` shipped the first mesh catalog expansion slice
- `0.33.1` shipped the first dungeon satisfaction slice by making boss approach beats explicit across route surfaces
- `0.33.2` shipped the repro/sandbox QA tooling slice
- `0.33.3` shipped the dungeon difficulty pacing follow-up and fixed remote-player jump presentation
- `0.33.4` shipped the dungeon room identity follow-up; the next implementation line should deepen social foundations rather than reopen `0.31`, `0.32`, or the current dungeon satisfaction pass

### Historical `0.22` implementation checklist

#### Slice 1: First-hour funnel audit

- [ ] Run a fresh-account path from register -> class select -> enter world -> first quest -> first dungeon-ready milestone
- [ ] Write down every point where the player can lose the next-step funnel
- [ ] Make the next-step guidance recoverable after menu close, recall, death, and return to town
- [ ] Confirm the start-screen, journal, map, minimap, hover hints, and objective tracker still agree after those state changes

Primary files:

- `index.html`
- `src/main.js`
- `src/ui/QuestUI.js`
- `src/ui/WorldMap.js`
- `src/ui/Minimap.js`
- `src/core/GameEngine.js`

#### Slice 2: Early combat readability closeout

- [ ] Add clearer feedback for out-of-range, blocked, and failed interactions
- [ ] Improve level-up, unlock, and reward moment feedback during the first hour
- [ ] Improve visibility of combat outcomes when multiple actors are on screen
- [ ] Improve remote-player combat readability enough that other players' actions are easier to follow

Primary files:

- `src/core/GameEngine.js`
- `src/core/AbilityController.js`
- `src/core/TransientEffects.js`
- `src/ui/UIManager.js`
- relevant server ability/event paths

#### Slice 3: Starter loot and progression explanation

- [ ] Clarify what junk, usable gear, and market-worthy items look like early
- [ ] Add clearer starter explanations for forge, gems, materials, and gold value
- [ ] Tighten tooltips, help copy, and any starter-economy text that still assumes prior knowledge
- [ ] Make the first upgrade loop understandable without external docs

Primary files:

- `src/ui/InventoryUI.js`
- `src/ui/ForgeUI.js`
- `src/core/ItemSystem.js`
- `src/ui/UIManager.js`
- `index.html`

#### Slice 4: `0.22` QA and ship review

- [ ] Run a targeted first-hour live QA pass and record findings
- [ ] Run targeted regression tests for changed onboarding, map, journal, and combat-feedback surfaces
- [ ] Decide whether `0.22` is complete or needs another focused slice
- [ ] If complete, add the final patch notes entry and update any docs that changed materially

Primary files:

- `index.html`
- `tests/`
- `docs/plans/`
- `README.md`
- `ROADMAP.md`

### Historical `0.22` implementation order

Run the remaining `0.22` work in this order.

1. Slice 1: first-hour funnel audit and recovery
2. Slice 3: starter loot and progression explanation
3. Slice 2: early combat readability closeout
4. Slice 4: `0.22` QA and ship review

Why this order:

- `0.22` is fundamentally the onboarding and readability release, so the first priority should be making the first-hour path coherent and recoverable
- Starter loot, forge, material, and economy clarity are the next biggest first-hour confusion risks after wayfinding
- Combat readability still matters, but it should close out the release after the onboarding and item-explanation gaps are no longer muddying the same play window
- QA and ship review should happen only after the player-facing promise is actually in place

### Exact next slice to build

Build the `0.34.0` social depth foundation slice.

Scope:

- deepen social foundations beyond party reward-sharing, chat, and the trading house
- keep existing party invite, party reward-sharing, and chat behavior stable unless explicitly changed and covered
- add a player-facing entry point that explains the new social state instead of hiding it behind commands
- update player-facing patch notes and regression coverage with each shipped slice

Why this is the best next slice:

- `0.30` closed the visible window clipping audit, including generated modals and special panels
- `0.31` closed the planned client-UX consistency layer across shared chrome, viewport safety, UI diffing, and overlay closeout
- `0.32.0` through `0.32.4` shipped the planned audio/accessibility baseline
- `0.33.0` moved procedural enemy silhouettes into MeshCatalog while preserving runtime output
- `0.33.1` made boss approach beats explicit across route surfaces
- `0.33.2` added faster deterministic manual QA
- `0.33.3` made Heroic and Mythic route pressure more explicit, so deeper dungeon room-identity work can continue with clearer endgame context
- `0.33.4` gave rooms stable identity names, so the dungeon satisfaction pass can pause while the next broad alpha gap moves to social depth

Exact files to start in:

- `server/internal/game/world.go`
- `server/internal/database/`
- `server/main.go`
- `src/ui/SocialUI.js`
- `src/ui/UIManager.js`

Target regression surfaces for this slice:

- social state and persistence tests
- party/chat/trading-adjacent UI tests for any new entry point
- `tests/VersionPresentation.test.js`

Definition of done for the next slice:

- the next social feature has a clear server data path and player-facing entry point
- existing party invites, party membership, chat, and trading-house flows remain stable unless deliberately changed and covered
- patch notes and the active status line move forward with the implementation

## Roadmap from `0.23` to `alpha 1.0`

This roadmap is intentionally bigger than the old `0.23` to `0.25` plan. The target now is not just a healthy mid-alpha. The target is the last alpha build before beta.

## `0.23` - Buildcraft and loot identity

Release promise: classes, specs, gear, gems, forge choices, and respecs feel distinct and worth caring about.

Primary goals:

- Sharpen branch and class identity
- Improve item rarity, affix, and slot readability
- Make forge, gems, and respec feel like one coherent buildcraft loop
- Make rewards and upgrades feel more exciting

Completion gates:

- Each class branch has a clearer fantasy and play reason
- Item decisions are easier to understand at a glance
- Buildcraft UX is coherent enough that players actually experiment
- Reward moments feel stronger than they do in `0.22`

Suggested milestone slices:

- `0.23.0`: class/spec fantasy audit and branch-difference plan
- `0.23.1`: class/spec presentation and identity pass
- `0.23.2`: loot, rarity, and item-compare readability pass
- `0.23.3`: forge, gems, respec, and buildcraft coherence pass
- `0.23.4`: reward-excitement polish, balance pass, and release QA

### `0.23` release-line status

Status: ready to ship

Closeout focus:

- reward moments should end the release line with more payoff and less spreadsheet feeling
- dungeon completion and room-clear messaging should celebrate what just happened before listing the ledger
- this slice should serve as the `0.23` closeout and release-QA checkpoint before moving to `0.24`

## `0.24` - Dungeon and endgame depth

Release promise: dungeons become a real replayable progression spine instead of just working content.

Primary goals:

- Stronger room-role pacing and encounter rhythm
- Better Heroic and Mythic identity beyond number scaling
- More meaningful repeat-run incentives
- Better party-ready dungeon UX

Completion gates:

- Dungeon runs feel less flat and more authored
- Endgame difficulty identity is visible and player-facing
- Max-level dungeon play has a stronger rerun reason
- Party dungeon flows feel deliberate and reliable

Suggested milestone slices:

- `0.24.0`: room-role tagging and dungeon pacing metadata
- `0.24.1`: elite, event, reward, and shrine cadence pass
- `0.24.2`: Heroic and Mythic identity pass
- `0.24.3`: rerun incentive and reward-ladder pass
- `0.24.4`: party dungeon UX hardening and release QA

### `0.24` release-line status

Status: ready to ship

Closeout focus:

- party members should understand whether they are starting fresh or re-entering an existing run before clicking the button
- reset ownership and empty-instance expiry should be explicit so group control feels less ambiguous
- this slice should keep the change small by hardening the Dungeon Guide state readout rather than redesigning the broader party system

## `0.25` - Social, economy, and retention foundations

Release promise: grouping, economy, and repeat play feel more important than optional.

Primary goals:

- Improve party flow and social importance
- Mature trading house usability
- Add stronger repeatable retention loops
- Improve admin, tuning, and live-ops foundations

Completion gates:

- Party play feels materially better than it did in `0.24`
- Trading house flow is easier to use
- The game has at least one strong daily or weekly return loop
- Operational iteration is less manual and less fragile

Suggested milestone slices:

- `0.25.0`: party-flow and social-importance pass
- `0.25.1`: trading house search, listing, and collection UX pass
- `0.25.2`: repeatable daily and weekly loop pass
- `0.25.3`: live-ops, tuning, and admin foundation pass
- `0.25.4`: retention-focused balance and release QA

## `0.26` to `0.29` - Multiplayer sync and authority pass

Release promise: remote players look smooth, trustworthy, and fully alive in multiplayer play.

Primary goals:

- Make overworld movement more authoritative
- Fix remote-player jump replication and presentation
- Improve replication for attacks, abilities, buffs, telegraphs, deaths, and other high-value action states
- Improve state/action ordering so remote events do not feel out of sync
- Add better multi-client validation for remote action visibility

Completion gates:

- Remote players consistently appear when and where they should
- Remote jumps, attacks, and spell usage read correctly on other clients
- Desync and snap-correction moments are materially reduced
- Multiplayer combat readability is good enough to support later guild and PvP work

Suggested milestone slices:

- `0.26`: overworld movement authority and correction-model pass
- `0.27`: remote jump, attack, and ability replication pass
- `0.28`: remote combat readability, sequencing, and presentation pass
- `0.29`: multi-client sync QA, soak, and hardening pass

## `0.30` to `0.39` - Full client quality pass

Release promise: the client feels complete, stable, and polished enough to stop reading like an alpha shell.

Primary goals:

- Finish client UX consistency across menus, settings, patch notes, help, and HUD
- Make Forge tab layouts large enough that bottom upgrade/action controls remain visible and clickable across normal view sizes
- Add a meaningful audio layer for combat, loot, menu, and moment-to-moment feel
- Add accessibility basics such as UI scale, keybinds, and clarity toggles
- Continue VFX, impact feedback, and menu feel improvements
- Harden repro and manual QA tooling further

Completion gates:

- The client feels coherent across all major surfaces
- Forge upgrade, socket, gem, and related tab actions are never hidden below the visible menu window during normal play
- Audio materially improves feedback and feel
- Accessibility basics exist and are usable
- Manual QA on the client is faster and safer than it is today

Suggested milestone slices:

- `0.30-0.31`: client UX consistency pass across menus, help, settings, HUD, and Forge tab sizing
- `0.32-0.33`: audio foundation pass for combat, loot, and UI
- `0.34-0.35`: accessibility baseline pass for UI scale, keybinds, and clarity toggles
- `0.36-0.37`: VFX, impact feedback, and menu-feel pass
- `0.38-0.39`: client QA-tooling, perf, and closeout pass

## `0.40` to `0.49` - Architecture and persistence hardening

Release promise: the game can safely support the bigger alpha feature set without collapsing under its own complexity.

Primary goals:

- Break up server and client monolith hot spots
- Harden persistence and reconnect flows
- Improve protocol clarity and networking discipline
- Expand regression coverage around multiplayer, persistence, and economy actions

Completion gates:

- Core runtime risks are materially lower than they were in `0.25`
- Reconnect and persistence flows are more trustworthy
- The codebase is safer to extend for guilds and PvP

Suggested milestone slices:

- `0.40-0.41`: client hot-spot decomposition pass
- `0.42-0.43`: server hot-spot decomposition pass
- `0.44-0.45`: persistence and reconnect hardening pass
- `0.46-0.47`: protocol, message-ordering, and network-discipline pass
- `0.48-0.49`: multiplayer, persistence, and economy regression-hardening pass

## `0.50` to `0.59` - Expanded multiplayer and economy

Release promise: multiplayer feels more socially useful even before guilds arrive.

Primary goals:

- Improve chat beyond a bare single-stream baseline
- Add friend, ignore, or similar social-presence systems
- Harden party presence, readiness, and multiplayer coordination UX
- Consider direct player-to-player trade if it materially improves the economy loop

Completion gates:

- Social play feels more alive between dungeon runs
- Basic multiplayer communication and presence are much stronger
- Economy friction is lower for normal player behavior

Suggested milestone slices:

- `0.50-0.51`: richer chat and channel structure pass
- `0.52-0.53`: friends, ignore, and presence systems pass
- `0.54-0.55`: party coordination and multiplayer-readiness UX pass
- `0.56-0.57`: direct-trade decision and implementation pass if approved
- `0.58-0.59`: social/economy QA and closeout pass

## `0.60` to `0.69` - Guilds

Release promise: guilds become a real social layer instead of a future idea.

Primary goals:

- Add guild creation, invites, roster, ranks, and permissions
- Add guild identity in chat, roster, and player presentation
- Add guild chat and basic guild management UX
- Decide whether guild banks, guild goals, or guild progression belong in the first guild release or later

Completion gates:

- Guilds are persistent and reliable
- Guild management is usable without external docs
- Guilds matter in normal play instead of existing as empty UI

Suggested milestone slices:

- `0.60-0.61`: guild data model, persistence, and invite flow pass
- `0.62-0.63`: guild roster, chat, and core management UX pass
- `0.64-0.65`: ranks, permissions, and moderation/admin rules pass
- `0.66-0.67`: guild identity and normal-play integration pass
- `0.68-0.69`: guild QA, reliability, and closeout pass

## `0.70` to `0.79` - PvP foundation

Release promise: PvP exists as a fair, readable, and technically reliable mode.

Primary goals:

- Define the first shipped PvP scope
- Add a first-class relationship and combat-legality model for ally, neutral, hostile, party, guild, and PvP-eligible states
- Add the server-authoritative rules needed for legal targets, safe zones, and PvP outcomes
- Add PvP-specific UX for target readability, death states, score, and feedback

Recommended initial scope:

- Start with duels, arena, or another structured PvP mode before attempting broad open-world PvP

Completion gates:

- PvP combat is fair enough to tune instead of structurally broken
- PvP target readability is strong enough to play without constant confusion
- PvP rules are clear and enforced server-side

Suggested milestone slices:

- `0.70-0.71`: choose first PvP scope and build relationship/combat-legality model
- `0.72-0.73`: server-authoritative PvP rules and safe-zone enforcement pass
- `0.74-0.75`: PvP client UX, target readability, and state presentation pass
- `0.76-0.77`: first PvP mode content, rewards, and rule tuning pass
- `0.78-0.79`: PvP QA, anti-abuse review, and closeout pass

## `0.80` to `0.89` - PvP, guild, and endgame maturity

Release promise: the late-alpha game has enough depth and multiplayer structure to feel like a real long-tail game.

Primary goals:

- Deepen the first PvP mode or add a second one if the first is healthy
- Connect guilds to normal multiplayer loops where appropriate
- Strengthen max-level progression, rewards, and social reasons to keep logging in
- Continue polishing endgame combat readability and reward pacing

Completion gates:

- Endgame multiplayer loops feel sticky instead of incidental
- PvP and guilds feel like real features, not feature-check boxes

Suggested milestone slices:

- `0.80-0.81`: deepen the first PvP mode and tighten reward pacing
- `0.82-0.83`: connect guilds to normal multiplayer loops where it improves retention
- `0.84-0.85`: max-level progression and return-loop reinforcement pass
- `0.86-0.87`: endgame combat readability and multiplayer-polish pass
- `0.88-0.89`: endgame social/PvP/guild QA and closeout pass

## `0.90` to `0.99` - Pre-beta hardening

Release promise: the game is feature-complete enough that beta is about hardening, balancing, scale, and content growth rather than missing foundations.

Primary goals:

- Full progression, persistence, and reconnect validation
- Economy and abuse-case hardening
- Multi-client soak, perf, and load validation
- Final alpha-wide polish sweep across combat, UX, multiplayer, guilds, and PvP
- Define beta gates and known limitations explicitly

Completion gates:

- The product is stable enough to invite broader beta usage
- The biggest remaining issues are balance, tuning, scale, and content depth, not missing systems
- Alpha 1.0 feels like the complete version of the alpha phase, not a halfway milestone

Suggested milestone slices:

- `0.90-0.91`: progression, persistence, and reconnect audit pass
- `0.92-0.93`: economy, exploit, and abuse-case hardening pass
- `0.94-0.95`: multi-client soak, perf, and load validation pass
- `0.96-0.97`: alpha-wide polish and unresolved-risk cleanup pass
- `0.98-0.99`: beta-gate review, final alpha closeout, and `alpha 1.0` ship decision

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
- Persistence, reconnect, and economy flows are trustworthy
- Beta would mainly be about scale, balance, polish, operations, and content expansion

## Active tracking rules for this doc

- Update the current version line when `index.html` changes
- Mark completed release gates and remaining work honestly
- Do not mark a version done until tests, QA, patch notes, and player-facing promise all line up
- When scope changes materially, update this doc before the release number moves forward
