# Eidolon Version Roadmap and Completion Plan (0.21 → 0.25)

> For Hermes: use this as the release-sequencing source of truth. Finish one release line completely before starting the next. Do not advance the version number just because a feature is partly working. A release is done when its player-facing promise, validation gates, patch notes, and QA pass are all done.

Goal: close out the remaining 0.21 polish/reliability work, then execute versions 0.22, 0.23, 0.24, and 0.25 one at a time with clear player-facing goals, concrete engineering tracks, and hard completion gates.

Architecture: treat each version as a full player experience, not a random bucket of unrelated tasks. Each release should have one headline promise, 3-5 major epics, objective completion gates, explicit QA coverage, and a patch-note-ready finish line. Preserve prior patch notes history. Keep implementation incremental on `master` with working slices committed as they land.

Tech Stack: Vanilla JavaScript client, Three.js rendering, Go authoritative multiplayer server, MongoDB persistence, Jest, ESLint, Go test, live browser QA.

---

## Release philosophy

One release at a time.

Rules:
1. Do not start broad implementation on the next version until the current version meets its release gates.
2. Every version needs both engineering completion and player-visible completion.
3. “Mostly done” does not count.
4. Patch notes, regression tests, and live QA are part of the work, not cleanup after the work.
5. Prefer vertical slices that leave `master` in a working state after each commit.

Definition of release completion:
- headline promise is fulfilled
- all major epics for that version are implemented
- major regressions are covered by tests
- full JS tests pass
- lint passes
- server tests pass
- targeted live QA is done for the affected surfaces
- patch notes entry is added without deleting old entries
- login/start-screen version display is updated when the release is actually shipped

---

## Version map at a glance

### 0.21 — Polish and reliability closeout
Release promise: the current alpha foundation feels solid instead of fragile.

### 0.22 — New player loop and readability
Release promise: the first 30-60 minutes are understandable, guided, and satisfying.

### 0.23 — Buildcraft and loot identity
Release promise: classes, specs, gear, and upgrades feel distinct and worth caring about.

### 0.24 — Dungeon and endgame depth
Release promise: dungeons become a real replayable progression spine.

### 0.25 — Social, economy, and retention
Release promise: multiplayer and longer-term play become sticky instead of incidental.

---

## 0.21 completion plan — Polish and reliability closeout

Status:
- already shipped in the 0.21 line: dungeon progression foundation, room-state/reward feedback, entrance hints, objective guidance, auto-loot, combat intent, modular UI extraction, menu close polish, asset caching, jump/shadow polish, and broad menu cleanup
- current displayed version in game: `Alpha 0.21.4`
- this release line should end only after the remaining polish/reliability debt that directly impacts the shipped foundation is closed

### 0.21 objectives

#### Objective A — Scene and instance transition correctness
Why it belongs in 0.21:
- this is reliability debt in already-shipped dungeon gameplay
- it reduces transition bugs, scene leaks, and future polish regressions

Deliverables:
- scene groups for environment, entities, and transient effects
- safer dungeon enter/exit cleanup behavior
- regression coverage around instance transitions and containment

Primary files:
- `src/core/RenderSystem.js`
- `src/core/GameEngine.js`
- `src/world/WorldGenerator.js`
- `tests/GameEngineDungeonContainment.test.js`
- `tests/GameEngineDungeonRoomState.test.js`

#### Objective B — HUD/UI update sanity and performance
Why it belongs in 0.21:
- the current shipped loop already has a lot of UI; now it needs to stop doing dumb work every frame

Deliverables:
- diffing/throttling for high-frequency HUD updates
- no noisy DOM churn for unchanged UI state
- no regressions in buff tracker, XP, objectives, combat intent, loot feedback

Primary files:
- `src/core/GameEngine.js`
- `src/ui/UIManager.js`
- extracted UI modules as needed
- HUD-related tests under `tests/`

#### Objective C — QA tooling and release hardening
Why it belongs in 0.21:
- future releases will get slower and sloppier without a faster reproducible QA path

Deliverables:
- reproducible sandbox or QA harness improvements
- updated manual QA checklist for menu/combat/dungeon regression paths
- explicit 0.21 release checklist completion

Primary files:
- `repro.html`
- `src/repro.js`
- `docs/plans/dungeon-manual-qa-checklist.md`
- new/updated release checklist docs if needed

### 0.21 non-goals
Do not turn 0.21 into a content expansion.

Keep out of 0.21:
- giant onboarding rewrite
- class identity overhaul
- large itemization expansion
- endgame systems beyond reliability polish
- guilds/social retention systems

### 0.21 completion gates
0.21 is done when:
- scene-group transition cleanup is shipped
- frequent HUD churn is reduced safely
- repro/manual QA path is improved enough to support future releases
- dungeon/menu/combat regression pass is completed live
- patch notes entry for the final 0.21 closeout build is written

### Recommended 0.21 execution order
1. scene-group instance transition cleanup
2. HUD diffing/throttling
3. repro sandbox + QA checklist hardening
4. release QA pass
5. final 0.21 patch notes / version roll-forward to 0.22 when actually ready

---

## 0.22 completion plan — New player loop and readability

Release promise: a new player can log in, choose a class, understand what to do, survive early combat, get rewards, and reach the first dungeon path without confusion.

### 0.22 objectives

#### Objective A — First-session onboarding flow
Deliverables:
- cleaner login/register/character-select/enter-world flow
- better first-quest funnel
- explicit first-destination guidance
- reduced “what am I supposed to do?” dead time

Primary surfaces:
- `index.html`
- `src/main.js`
- `src/ui/UIManager.js`
- `src/ui/QuestUI.js`
- `src/core/GameEngine.js`

#### Objective B — Moment-to-moment combat readability
Deliverables:
- clearer enemy telegraphs and impact windows
- stronger level-up / unlock / reward feedback
- better state visibility for buffs/debuffs and combat outcomes
- fewer ambiguous failures when out of range / blocked / unable to interact

Primary surfaces:
- `src/core/GameEngine.js`
- `src/core/TransientEffects.js`
- `src/ui/UIManager.js`
- `src/core/AbilityController.js`
- relevant enemy/server ability paths

#### Objective C — Guidance and wayfinding
Deliverables:
- journal/objective/map/minimap alignment
- first-dungeon approach path feels intentional
- better town-to-content readability
- stronger use of hints without spamming the player

Primary surfaces:
- `src/ui/QuestUI.js`
- `src/ui/WorldMap.js`
- `src/ui/Minimap.js`
- `src/core/GameEngine.js`

#### Objective D — Starter progression clarity
Deliverables:
- clearer item rarity language
- clearer gold/material/upgrading expectations
- inventory/sorting/auto-loot behavior that feels obvious early
- no confusing starter-economy friction

Primary surfaces:
- `src/ui/InventoryUI.js`
- `src/ui/ForgeUI.js`
- `src/core/ItemSystem.js`
- settings/help/tooltips/patch notes as needed

### 0.22 non-goals
Keep out:
- huge endgame difficulty expansion
- guild/clan systems
- giant trading/economy rework
- broad unique-item chase implementation

### 0.22 completion gates
0.22 is done when:
- first session from fresh login through first meaningful dungeon-ready milestone is coherent
- new players receive enough guidance without opening docs or guessing
- early combat and interaction feedback is readable
- early gear/material/loot loop is understandable
- live QA confirms the first-hour loop feels intentional

### Recommended 0.22 epics
1. first-session quest funnel and login/start-screen polish
2. readability pass for combat/status/interaction feedback
3. map/journal/objective synchronization pass
4. starter-economy and early item explanation pass
5. first-hour live QA and final tuning

---

## 0.23 completion plan — Buildcraft and loot identity

Release promise: player choices around class, spec, items, gems, forge, and respec feel meaningful and distinct.

### 0.23 objectives

#### Objective A — Class/spec identity pass
Deliverables:
- clearer spec fantasy per branch
- reduced overlap between branches
- more obvious reasons to commit to a path
- better presentation of branch strengths/weaknesses

Primary surfaces:
- `src/core/Constants.js`
- class files under `src/entities/`
- server ability handlers under `server/internal/game/`
- `src/ui/SkillTreeUI.js`

#### Objective B — Itemization identity pass
Deliverables:
- clearer affix and rarity roles
- better chase differentiation between gear tiers
- more obvious slot identity and upgrade choices
- better compare/readability for item decisions

Primary surfaces:
- `src/core/ItemSystem.js`
- `src/ui/InventoryUI.js`
- `src/ui/UIManager.js`
- server reward/drop paths

#### Objective C — Forge, gem, and respec coherence
Deliverables:
- forge/gems/respec feel like one connected buildcraft system
- easier experimentation without making choices meaningless
- clearer costs and expected outcomes
- less friction in understanding upgrade decisions

Primary surfaces:
- `src/ui/ForgeUI.js`
- `src/ui/SkillTreeUI.js`
- server upgrade/respec logic
- tests around item/gem/skill persistence and UI

#### Objective D — Reward excitement
Deliverables:
- more memorable item drops and upgrade moments
- clearer feedback when a drop is interesting
- stronger reason to inspect/equip/store/sell items

Primary surfaces:
- client loot feedback
- tooltip presentation
- reward summary surfaces
- item/drop config paths

### 0.23 non-goals
Keep out:
- major dungeon-structure rewrite as the headline
- guild/social systems as primary scope
- massive retention/live-ops scaffolding

### 0.23 completion gates
0.23 is done when:
- each class branch feels materially different
- gear choices are easier to understand and more exciting to chase
- forge/gem/respec loop is coherent
- item compare/tooltip/reward UX supports real build decisions
- live QA shows that buildcraft now feels like a core reason to play

### Recommended 0.23 epics
1. class/spec fantasy pass
2. loot/affix/rarity readability pass
3. forge-gem-respec coherence pass
4. item compare and reward-excitement pass
5. balance + live QA pass for buildcraft

---

## 0.24 completion plan — Dungeon and endgame depth

Release promise: dungeons are the real replayable backbone of the game, with strong pacing, difficulty identity, and reasons to rerun content.

### 0.24 objectives

#### Objective A — Dungeon pacing and encounter-role depth
Deliverables:
- stronger room-role pacing
- better alternation between travel, elite, event, reward, shrine, boss moments
- less flat or repetitive dungeon feel

Primary surfaces:
- `server/internal/game/world.go`
- dungeon metadata/config files
- `src/ui/QuestUI.js`
- `src/ui/Minimap.js`

#### Objective B — Endgame difficulty identity
Deliverables:
- Normal/Heroic/Mythic feel distinct beyond raw numbers
- stronger boss behavior or encounter identity at high difficulty
- clearer reward and challenge messaging per difficulty

Primary surfaces:
- server dungeon scaling and reward logic
- dungeon menu and summary UI
- progression/rules docs/tests

#### Objective C — Repeatable incentive loop
Deliverables:
- stronger reasons to rerun dungeons
- clearer reward ladder at max level
- optional modifier/variant foundation for future Mythic+ style systems

Primary surfaces:
- server reward and progression paths
- dungeon summary UI
- patch notes / roadmap hooks

#### Objective D — Party-ready dungeon UX
Deliverables:
- start/continue/leave/retry flows are bulletproof
- party clarity around instance state is stronger
- failure/reward/end-of-run UX feels finished

Primary surfaces:
- `src/ui/UIManager.js`
- `src/ui/SocialUI.js`
- `src/core/GameEngine.js`
- server party/instance flows

### 0.24 non-goals
Keep out:
- full guild social layer
- broad trading/economy retention work
- major starter onboarding rewrite

### 0.24 completion gates
0.24 is done when:
- dungeon runs have better pacing and less repetition
- endgame difficulty tiers feel materially different
- max-level dungeon loop has a strong rerun incentive structure
- party dungeon experience feels deliberate and reliable
- live QA confirms dungeon replayability is now a core strength

### Recommended 0.24 epics
1. room-role and pacing expansion
2. Heroic/Mythic identity pass
3. repeatable reward loop reinforcement
4. party-ready dungeon UX hardening
5. endgame tuning and QA

---

## 0.25 completion plan — Social, economy, and retention

Release promise: Eidolon becomes sticky. Playing with others matters, the economy is more usable, and players have clearer reasons to come back.

### 0.25 objectives

#### Objective A — Party/social importance pass
Deliverables:
- better party discovery and invite flow
- clearer group status and role visibility
- stronger benefits to cooperative play
- less friction around grouping for dungeons and world content

Primary surfaces:
- `src/ui/SocialUI.js`
- party UI / invite flows / server party handling
- minimap/map/social affordances

#### Objective B — Trading/economy maturity pass
Deliverables:
- trading house usability improvements
- clearer listing/search/buy/sell experience
- safer and more understandable item circulation
- fewer economy UX paper cuts

Primary surfaces:
- `src/ui/TradingUI.js`
- server trade/listing flows
- item presentation and economy messaging

#### Objective C — Longer-term retention loops
Deliverables:
- repeatable goals and milestone rewards
- reasons to log back in beyond one dungeon run
- lightweight progression hooks that feel valuable without being mobile-game sludge

Primary surfaces:
- quest/progression/reward systems
- server progression state
- UI surfaces for repeatable objectives

#### Objective D — Live-ops / tuning foundation
Deliverables:
- better balancing hooks
- telemetry/reporting/admin conveniences where appropriate
- cleaner patch-note and release discipline

Primary surfaces:
- server metrics/admin paths
- lightweight tooling/docs support
- release process docs

### 0.25 non-goals
Keep out:
- rewriting the core combat model
- giant catch-up work that belongs in 0.22/0.23
- content bloat without retention purpose

### 0.25 completion gates
0.25 is done when:
- grouping and multiplayer feel more important than optional
- trading is materially easier to use
- the game has at least one solid “come back tomorrow / come back this week” loop
- live tuning and operational iteration are easier than they were in 0.21-0.24

### Recommended 0.25 epics
1. party/social improvement pass
2. trading house/economy UX maturity pass
3. repeatable retention loop pass
4. live-ops/admin/tuning foundation pass
5. retention-focused QA and tuning

---

## Cross-version execution order

### Step 1 — Finish 0.21 completely
Required before broad 0.22 work:
- scene-group cleanup
- HUD diff/throttle pass
- QA tooling/repro improvements
- 0.21 release QA pass

### Step 2 — Run 0.22 as the onboarding/readability release
Do not mix it with itemization or endgame sprawl.

### Step 3 — Run 0.23 as the buildcraft release
Do not bury class/item identity under dungeon/system churn.

### Step 4 — Run 0.24 as the dungeon/endgame release
This is where replayability becomes the headline.

### Step 5 — Run 0.25 as the sticky multiplayer/economy release
Finish the loop by making players want to stay and return.

---

## Immediate next actions

### Action 1 — Close out 0.21
Create and execute a concrete 0.21 closeout checklist with slices for:
1. scene-group instance transition cleanup
2. HUD diffing/throttling
3. repro/manual QA tooling hardening
4. release QA and final 0.21 patch-notes rollup

### Action 2 — Keep release docs aligned
When each version actually ships:
- update login/start-screen version text in `index.html`
- add a new patch notes entry at the top of `#patch-notes-history`
- preserve all older patch notes entries
- update `README.md` / `docs/ROADMAP.md` only where reality changed

### Action 3 — Use version completion reviews
Before rolling to the next version, do a version review covering:
- implemented objectives
- unfinished objectives
- known defects
- live QA results
- decision: ship or keep working

---

## Recommended first implementation slice right now

Start with 0.21 Objective A:
- scene-group instance transition correctness

Why:
- it is foundational reliability work under already-shipped dungeon content
- it reduces bug risk for every later release
- it is cleaner to fix before layering more onboarding, buildcraft, dungeon, and social work on top

Suggested commit sequence:
1. `refactor: add scene groups for instance transitions`
2. `perf: throttle and diff high-frequency hud updates`
3. `tooling: expand repro sandbox for gameplay qa`
4. `docs: finalize 0.21 release checklist`

---

## Planning note

This file is the release-sequencing handoff doc for 0.21 through 0.25. Older plan docs remain useful as implementation detail references, but this is the top-level order of operations.
