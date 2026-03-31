# Combat Intent and Target Clarity Implementation Plan

> For Hermes: Use subagent-driven-development skill to implement this plan task-by-task.

Goal: Make combat decisions obvious before the player clicks or casts by adding hovered-target highlighting, target status/range feedback, and a lightweight damage preview.

Architecture: Keep this slice client-side and incremental. Reuse the existing `hoveredEntity`, `performRaycast()`, `AbilityController` range logic, and HUD/UI infrastructure instead of inventing a new targeting system. `GameEngine` should own the authoritative local combat-intent snapshot for the current frame, `AbilityController` should provide range/damage helpers, and `UIManager` should render a small, low-churn HUD card. Visual target highlighting should avoid mutating gameplay state and should be implemented as attach/detach visual helpers rather than per-frame material replacement.

Tech Stack: Vanilla JavaScript client, Three.js, existing `GameEngine`/`AbilityController`/`UIManager` modules, Jest for client tests.

---

## Goals and constraints

- Improve clarity without changing server combat authority.
- Do not change server hit validation or targeting rules in this PR.
- Avoid per-frame DOM spam and avoid expensive per-frame material cloning.
- Preserve current click-to-move, click-to-interact, and cast buffering behavior.
- Reuse existing `hoveredEntity`, `pendingAbilityTarget`, and `getAbilityCastRange()` paths.
- Mobile can inherit the HUD card later; desktop hover clarity is the priority for this PR.

## Current relevant code

- `src/core/GameEngine.js`
  - owns `hoveredEntity`
  - performs raycasts in `performRaycast()`
  - routes left-click attack/move logic
  - updates per-frame combat behavior in `update()`
- `src/core/AbilityController.js`
  - already computes cast range with `getAbilityCastRange()`
  - already handles `pendingAbilityTarget` chase-then-cast behavior
  - is the right place for light helper methods around intent/range/damage preview
- `src/ui/UIManager.js`
  - owns HUD rendering and update cadence
  - already shows player HUD, timer, and objectives panel
- Tests already covering nearby behavior:
  - `tests/AbilityRangeInteraction.test.js`
  - `tests/AbilityControllerPendingCast.test.js`
  - `tests/GameEngineDungeonContainment.test.js`
  - `tests/GameEngineRespawn.test.js`

## Proposed player-facing behavior

1. Hovering a hostile enemy shows a visible target ring/highlight.
2. A compact HUD card appears with:
   - target name
   - target type/category if available
   - target distance
   - status text: `In Range`, `Move Into Range`, or `Invalid`
   - soft damage preview for basic attack and currently selected ability
3. If an ability is queued on a pending target, the HUD card should continue to reflect that target until cleared.
4. Hovering loot/NPCs should not show combat intent UI.
5. No flicker when the cursor remains on the same target.

## Scope for this PR

In scope:
- hovered hostile target highlight
- HUD target-intent card
- in-range / move-into-range / invalid feedback
- soft damage preview using client-known stats only
- regression tests for state computation and UI rendering

Out of scope:
- server damage prediction
- exact tooltip-grade combat math for every modifier
- mobile auto-target UX redesign
- loot pickup improvements
- dungeon marker/navigation hints

---

## Task 1: Add a stable combat-intent state object to GameEngine

Objective: Create one place in the engine that computes and stores the currently relevant combat target and range state.

Files:
- Modify: `src/core/GameEngine.js`
- Test: `tests/GameEngineCombatIntent.test.js`

Step 1: Write failing tests for combat-intent state derivation

Create `tests/GameEngineCombatIntent.test.js` with cases for:
- hovered hostile target in basic-attack range => `In Range`
- hovered hostile target outside range => `Move Into Range`
- hovered non-hostile target => no combat-intent card
- pending ability target remains the effective combat target when hover is lost
- dead target => cleared intent

Suggested harness shape:
```js
import * as THREE from 'three';
import { GameEngine } from '../src/core/GameEngine.js';

function createEngine() {
  const engine = Object.create(GameEngine.prototype);
  engine.player = {
    abilityName: 'Fireball',
    constructor: { name: 'Wizard' },
    position: new THREE.Vector3(0, 0, 0),
    stats: { damage: 30 }
  };
  engine.abilityController = {
    pendingAbilityTarget: null,
    pendingAbilitySkill: null,
    getAbilityCastRange: () => 12,
    buildSoftDamagePreview: () => ({ basicAttack: 30, ability: 45, abilityName: 'Fireball' })
  };
  engine.isHostileActorTarget = (entity) => Boolean(entity?.hostile);
  return engine;
}
```

Step 2: Run the targeted test and confirm failure

Run:
`cd /var/lib/hermes/eidolon-prs && npm test -- --runTestsByPath tests/GameEngineCombatIntent.test.js`

Expected: FAIL because the new combat-intent helpers do not exist yet.

Step 3: Implement intent-state helpers in `src/core/GameEngine.js`

Add lightweight engine state in the constructor:
```js
this.combatIntent = null;
this.highlightedCombatTarget = null;
this.combatIntentDirty = true;
```

Add methods on `GameEngine`:
- `getEffectiveCombatTarget()`
- `getBasicAttackRangeForPlayer(player)`
- `buildCombatIntentState()`
- `refreshCombatIntentState()`
- `clearCombatIntentState()`

Behavior:
- prefer `abilityController.pendingAbilityTarget` when valid
- otherwise use `hoveredEntity` if it is a hostile live actor
- compute `distance`
- compute `basicAttackRange`
- compute `abilityRange` from `pendingAbilitySkill || player.abilityName`
- mark `inBasicRange`, `inAbilityRange`
- emit normalized status values like:
  - `in_range`
  - `move_into_range`
  - `invalid`

Minimal shape:
```js
return {
  entity,
  entityId: entity.id,
  name: entity.name || entity.constructor?.name || 'Enemy',
  distance,
  basicAttackRange,
  abilityRange,
  inBasicRange: distance <= basicAttackRange,
  inAbilityRange: distance <= abilityRange,
  status: distance <= abilityRange ? 'in_range' : 'move_into_range',
  preview: this.abilityController.buildSoftDamagePreview(entity)
};
```

Step 4: Call `refreshCombatIntentState()` from low-churn places

Update `GameEngine` so intent is refreshed when:
- raycast result changes in `performRaycast()`
- pending target is cleared/set through normal interaction flow
- the main update loop runs while player exists

Guard against churn:
- only notify UI when target id or key state fields change
- do not rebuild DOM every frame if values are unchanged

Step 5: Re-run the targeted engine tests

Run:
`cd /var/lib/hermes/eidolon-prs && npm test -- --runTestsByPath tests/GameEngineCombatIntent.test.js`

Expected: PASS.

Step 6: Commit

```bash
cd /var/lib/hermes/eidolon-prs
git add src/core/GameEngine.js tests/GameEngineCombatIntent.test.js
git commit -m "feat: add combat intent engine state"
```

---

## Task 2: Add cheap soft-preview helpers to AbilityController

Objective: Centralize simple range and damage-preview helpers so the HUD can explain what the next action likely does.

Files:
- Modify: `src/core/AbilityController.js`
- Modify: `tests/AbilityRangeInteraction.test.js`

Step 1: Add failing tests for preview helpers

Extend `tests/AbilityRangeInteraction.test.js` with cases for:
- `buildSoftDamagePreview()` returns basic attack damage from player stats
- selected skill uses a small heuristic multiplier over basic damage
- fallback preview still works when no skill override is active

Example expectation:
```js
const preview = controller.buildSoftDamagePreview(target);
expect(preview.basicAttack).toBe(40);
expect(preview.abilityName).toBe('Fireball');
expect(preview.ability).toBeGreaterThanOrEqual(40);
```

Step 2: Run targeted tests and verify failure

Run:
`cd /var/lib/hermes/eidolon-prs && npm test -- --runTestsByPath tests/AbilityRangeInteraction.test.js`

Expected: FAIL because the helper does not exist.

Step 3: Implement helper methods in `src/core/AbilityController.js`

Add:
- `getAbilityIntentSkillName()`
- `getAbilityIntentRange()`
- `buildSoftDamagePreview(target = null, skillNameOverride = null)`

Rules:
- use existing configured range via `getAbilityCastRange()`
- use conservative heuristic multipliers for preview only
- do not promise exact damage
- prefer simple deterministic numbers such as:
  - basic attack: `player.stats.damage`
  - ability preview: `Math.round(player.stats.damage * multiplier)`
- keep multiplier logic small and explicit for currently important skills/classes; otherwise use a default like `1.25`

Return shape:
```js
{
  basicAttack: 40,
  ability: 52,
  abilityName: 'Fireball',
  isEstimate: true
}
```

Step 4: Re-run targeted tests

Run:
`cd /var/lib/hermes/eidolon-prs && npm test -- --runTestsByPath tests/AbilityRangeInteraction.test.js`

Expected: PASS.

Step 5: Commit

```bash
cd /var/lib/hermes/eidolon-prs
git add src/core/AbilityController.js tests/AbilityRangeInteraction.test.js
git commit -m "feat: add soft combat preview helpers"
```

---

## Task 3: Add target highlight visuals in GameEngine

Objective: Make the currently relevant hostile target visually obvious in-world.

Files:
- Modify: `src/core/GameEngine.js`
- Create: `tests/GameEngineTargetHighlight.test.js`

Step 1: Write failing tests for highlight attach/detach behavior

Create `tests/GameEngineTargetHighlight.test.js` with cases for:
- applying highlight to a hostile target attaches a helper mesh/object once
- switching targets detaches old helper and attaches new helper
- clearing intent removes highlight
- non-hostile targets never receive combat highlight

The test can assert helper lifecycle with stubs instead of full rendering.

Step 2: Run targeted tests and confirm failure

Run:
`cd /var/lib/hermes/eidolon-prs && npm test -- --runTestsByPath tests/GameEngineTargetHighlight.test.js`

Expected: FAIL.

Step 3: Implement highlight helper methods in `src/core/GameEngine.js`

Add methods:
- `createCombatTargetHighlight()`
- `attachCombatTargetHighlight(entity)`
- `detachCombatTargetHighlight()`
- `updateCombatTargetHighlight()`

Implementation guidance:
- prefer a simple Three.js ring or circle mesh at the target base
- store one reusable helper mesh on the engine
- attach to the target mesh or position it under the target each update
- never clone target materials every frame
- only show for live hostile actors

Example approach:
```js
const ring = new THREE.Mesh(
  new THREE.RingGeometry(0.7, 0.95, 32),
  new THREE.MeshBasicMaterial({ color: 0xffd966, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
);
ring.rotation.x = -Math.PI / 2;
ring.position.y = 0.08;
```

Step 4: Wire highlight updates into intent refresh/update lifecycle

- when combat intent changes, update the highlighted target
- when target dies or becomes invalid, clear highlight
- on instance transitions / destroy paths, ensure highlight is removed

Step 5: Re-run targeted tests

Run:
`cd /var/lib/hermes/eidolon-prs && npm test -- --runTestsByPath tests/GameEngineTargetHighlight.test.js`

Expected: PASS.

Step 6: Commit

```bash
cd /var/lib/hermes/eidolon-prs
git add src/core/GameEngine.js tests/GameEngineTargetHighlight.test.js
git commit -m "feat: highlight hovered hostile targets"
```

---

## Task 4: Add a compact HUD combat-intent card in UIManager

Objective: Surface target name, distance, status, and preview damage without requiring menus.

Files:
- Modify: `index.html`
- Modify: `src/styles/hud.css`
- Modify: `src/styles/responsive.css`
- Modify: `src/ui/UIManager.js`
- Create: `tests/CombatIntentUI.test.js`

Step 1: Write failing UI rendering tests

Create `tests/CombatIntentUI.test.js` with cases for:
- card hidden when no intent state is provided
- card shows name, distance, and `In Range`
- card shows `Move Into Range` when out of range
- card shows preview damage labels
- repeated updates with same state do not duplicate DOM entries

Suggested DOM fixture ids:
- `combat-intent-panel`
- `combat-intent-name`
- `combat-intent-meta`
- `combat-intent-status`
- `combat-intent-preview-basic`
- `combat-intent-preview-ability`

Step 2: Run targeted UI test and confirm failure

Run:
`cd /var/lib/hermes/eidolon-prs && npm test -- --runTestsByPath tests/CombatIntentUI.test.js`

Expected: FAIL.

Step 3: Add HUD container to `index.html`

Add a new compact panel near the objectives panel.

Suggested markup:
```html
<div id="combat-intent-panel" style="display:none; position: fixed; top: 88px; right: 20px; width: 280px; z-index: 120;">
  <div id="combat-intent-name"></div>
  <div id="combat-intent-meta"></div>
  <div id="combat-intent-status"></div>
  <div class="combat-intent-preview-row">
    <span>Attack</span>
    <span id="combat-intent-preview-basic"></span>
  </div>
  <div class="combat-intent-preview-row">
    <span id="combat-intent-preview-ability-label">Ability</span>
    <span id="combat-intent-preview-ability"></span>
  </div>
</div>
```

Step 4: Add styles in `src/styles/hud.css` and `src/styles/responsive.css`

Style goals:
- match current HUD/objectives aesthetic
- status color variants:
  - green for in range
  - amber for move into range
  - red/gray for invalid
- responsive placement on mobile/narrow screens

Step 5: Implement render helpers in `src/ui/UIManager.js`

Add DOM refs in constructor and methods:
- `updateCombatIntent(intent)`
- `clearCombatIntent()`
- `formatCombatIntentStatus(status)`

Render rules:
- hide panel if no intent
- display rounded distance like `9.4m`
- show `~` prefix for estimated damage
- avoid rewriting DOM if serialized key fields did not change

Step 6: Re-run targeted UI tests

Run:
`cd /var/lib/hermes/eidolon-prs && npm test -- --runTestsByPath tests/CombatIntentUI.test.js`

Expected: PASS.

Step 7: Commit

```bash
cd /var/lib/hermes/eidolon-prs
git add index.html src/styles/hud.css src/styles/responsive.css src/ui/UIManager.js tests/CombatIntentUI.test.js
git commit -m "feat: add combat intent hud card"
```

---

## Task 5: Wire GameEngine intent updates into the UI

Objective: Connect engine intent state to the HUD card and ensure it stays synchronized without flicker.

Files:
- Modify: `src/core/GameEngine.js`
- Modify: `src/ui/UIManager.js`
- Test: `tests/GameEngineCombatIntent.test.js`

Step 1: Extend failing integration tests

Add assertions that when `refreshCombatIntentState()` runs:
- `uiManager.updateCombatIntent(intent)` is called for hostile targets
- `uiManager.clearCombatIntent()` is called when combat intent becomes null

Step 2: Run targeted tests and confirm failure

Run:
`cd /var/lib/hermes/eidolon-prs && npm test -- --runTestsByPath tests/GameEngineCombatIntent.test.js tests/CombatIntentUI.test.js`

Expected: FAIL until the engine-to-UI wiring is added.

Step 3: Implement the UI handoff

In `GameEngine.refreshCombatIntentState()`:
- compare previous/new intent snapshot
- if changed and intent exists: `this.uiManager?.updateCombatIntent(intent)`
- if changed and no intent: `this.uiManager?.clearCombatIntent()`

Also ensure cleanup during:
- instance change
- target invalidation
- engine destroy if relevant

Step 4: Re-run targeted tests

Run:
`cd /var/lib/hermes/eidolon-prs && npm test -- --runTestsByPath tests/GameEngineCombatIntent.test.js tests/CombatIntentUI.test.js`

Expected: PASS.

Step 5: Commit

```bash
cd /var/lib/hermes/eidolon-prs
git add src/core/GameEngine.js src/ui/UIManager.js tests/GameEngineCombatIntent.test.js tests/CombatIntentUI.test.js
git commit -m "feat: wire combat intent state into hud updates"
```

---

## Task 6: Full regression pass and manual verification notes

Objective: Make sure the new UI/intent slice does not regress existing gameplay.

Files:
- Modify: `docs/plans/2026-03-31-combat-intent-target-clarity-plan.md` only if notes need correction after implementation

Step 1: Run targeted client tests

Run:
`cd /var/lib/hermes/eidolon-prs && npm test -- --runTestsByPath tests/GameEngineCombatIntent.test.js tests/GameEngineTargetHighlight.test.js tests/CombatIntentUI.test.js tests/AbilityRangeInteraction.test.js tests/AbilityControllerPendingCast.test.js`

Expected: PASS.

Step 2: Run full client suite and lint

Run:
`cd /var/lib/hermes/eidolon-prs && npm test -- --runInBand`
`cd /var/lib/hermes/eidolon-prs && npm run lint`

Expected: PASS.

Step 3: Manual verification checklist

Verify in-game:
- hovering a live hostile shows a target ring
- target card shows name + distance
- moving in/out of range flips status cleanly
- queued cast target remains visible while chasing into range
- dead targets clear highlight and card immediately
- loot/NPC hover does not show combat-intent card
- no visible flicker when sweeping cursor across enemies
- no console spam from repeated state updates

Step 4: Final commit if needed

```bash
cd /var/lib/hermes/eidolon-prs
git status --short
```

If follow-up fixes were required, commit them with a focused message like:
```bash
git add <files>
git commit -m "fix: polish combat intent feedback edge cases"
```

---

## Definition of done

- Hovered hostile enemies clearly show a visual target highlight.
- The HUD exposes target name, distance, and attack/cast range state.
- The HUD shows soft preview values for basic attack and selected ability.
- Pending cast chase behavior keeps the correct target visible in the HUD.
- Non-combat targets do not render combat-intent UI.
- Client tests and lint pass.

## Recommended branch / PR metadata

Branch name:
- `feat/combat-intent-feedback`

PR title:
- `feat: add combat intent feedback and target clarity`

PR summary bullets:
- add hovered hostile target highlight and stable combat-intent engine state
- add HUD card for target name, distance, range state, and soft damage preview
- preserve existing click-to-move/cast behavior while improving targeting clarity
- add regression coverage for engine state, highlight lifecycle, and HUD rendering
