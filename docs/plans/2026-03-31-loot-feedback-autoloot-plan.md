# Loot Pickup Reliability, Feedback, and Optional Auto-Loot Implementation Plan

> For Hermes: Use subagent-driven-development skill to implement this plan task-by-task.

Goal: Make loot pickup feel reliable and responsive by improving pickup feedback, reducing failed-click friction, and adding an optional auto-loot toggle for low-friction collection.

Architecture: Keep this PR client-side and incremental. Reuse the existing `LootDrop`, `pickupLoot()`, `moveToAndInteract()`, `pendingInteraction`, and UI settings/localStorage patterns instead of creating a new loot system. `GameEngine` should own loot interaction state, throttling, and optional auto-loot scans; `UIManager` should expose a simple setting and concise HUD/chat feedback; `LootDrop` should expose stronger visual affordances for pickup range/readiness without changing server authority.

Tech Stack: Vanilla JavaScript client, Three.js, existing `GameEngine` / `UIManager` / `LootDrop` modules, Jest for client tests.

---

## Goals and constraints

- Preserve server authority for actual pickup success/failure.
- Do not change server inventory validation in this PR.
- Improve pickup responsiveness without introducing spammy chat or floating-text noise.
- Reuse existing optimistic pickup logic and inventory-full throttling.
- Optional auto-loot must be user-controlled and persisted in localStorage.
- Auto-loot should prioritize low-friction behavior, not vacuum the whole map.
- Keep this PR focused on loot pickup reliability/feedback; defer room-clear/boss-summary reward moments to a later PR if needed.

## Current relevant code

- `src/core/GameEngine.js`
  - smart ground click checks nearby loot
  - `pickupLoot(lootId)` already performs optimistic pickup gating and inventory-full throttling
  - `pendingInteraction` loop retries pickup when in range
  - `moveToAndInteract(entity)` drives auto-walk-to-loot interaction
- `src/entities/LootDrop.js`
  - owns loot orb mesh, hitbox, bobbing, and item label
  - currently has no notion of pickup radius/readiness visuals
- `src/ui/UIManager.js`
  - already persists settings via localStorage (`graphicsQuality`, `graphicsBrightness`)
  - can host an auto-loot settings toggle and compact feedback helpers
- `index.html`
  - already has a settings screen with graphics controls
- Existing tests worth extending:
  - `tests/GameEngineDungeonContainment.test.js`
  - `tests/ItemSystem.test.js`
  - `tests/GemPresentation.test.js`
  - new loot-specific tests should be added rather than overloading unrelated suites

## Proposed player-facing behavior

1. Loot near the player clearly communicates pickup readiness:
   - in range = brighter, more collectible-looking
   - out of range = visible but less emphasized
2. When the player clicks near loot, pickup should feel sticky and forgiving.
3. If pickup fails because inventory is full, the player should get clear throttled feedback, not repeated spam.
4. If optional auto-loot is enabled:
   - nearby eligible loot is automatically picked up while moving near it
   - auto-loot should use a short radius around the player
   - auto-loot should not repeatedly hammer impossible pickups
5. Feedback should indicate successful pickups with concise rarity-forward text.

## Scope for this PR

In scope:
- pickup readiness/radius feedback
- stronger interaction helpers around nearby loot
- optional auto-loot setting in settings UI
- localStorage persistence for auto-loot
- concise success/failure pickup feedback
- client regression tests for loot feedback behavior

Out of scope:
- server-side inventory or loot spawning changes
- room-clear reward moments
- boss drop summary panel
- per-rarity auto-loot rules beyond a single initial toggle
- advanced loot filters

---

## Task 1: Add tests for loot interaction state and auto-loot settings persistence

Objective: Lock in expected behavior before implementation.

Files:
- Create: `tests/LootFeedback.test.js`
- Create: `tests/UIManagerAutoLootSettings.test.js`

Step 1: Write failing tests for GameEngine loot helpers

Create `tests/LootFeedback.test.js` covering:
- in-range loot is eligible for auto-pickup
- out-of-range loot is not auto-picked
- auto-loot does nothing when disabled
- inventory-full throttle does not spam repeated feedback
- successful pickup creates a concise pickup-feedback payload/state

Suggested harness shape:
```js
const engine = Object.create(GameEngine.prototype);
engine.player = { position: new THREE.Vector3(0, 0, 0), inventory: [] };
engine.remotePlayers = new Map();
engine.uiManager = { showLootPickupToast: jest.fn() };
engine.floatingTextManager = { spawn: jest.fn() };
engine.network = { send: jest.fn() };
engine.autoLootEnabled = true;
```

Step 2: Write failing tests for settings persistence

Create `tests/UIManagerAutoLootSettings.test.js` covering:
- `UIManager` reads `eidolon.autoLootEnabled` from localStorage
- toggling the checkbox updates localStorage
- `onAutoLootChange` callback is fired with the new value

Step 3: Run targeted tests to verify failure

Run:
`cd /var/lib/hermes/eidolon-prs && npm test -- --runTestsByPath tests/LootFeedback.test.js tests/UIManagerAutoLootSettings.test.js`

Expected: FAIL because the helpers/settings do not exist yet.

Step 4: Commit once the tests exist and fail locally if you want fine-grained TDD commits

```bash
cd /var/lib/hermes/eidolon-prs
git add tests/LootFeedback.test.js tests/UIManagerAutoLootSettings.test.js
git commit -m "test: add loot feedback and auto-loot settings coverage"
```

---

## Task 2: Add persisted auto-loot setting to UIManager and settings screen

Objective: Give players a persistent, optional toggle for auto-loot.

Files:
- Modify: `index.html`
- Modify: `src/ui/UIManager.js`
- Test: `tests/UIManagerAutoLootSettings.test.js`

Step 1: Add settings UI to `index.html`

Add a simple checkbox row under the existing graphics controls.

Suggested markup:
```html
<div style="display: flex; justify-content: space-between; align-items: center; gap: 12px;">
  <label for="auto-loot-enabled" style="color: #ffd700; font-size: 13px;">Auto-Loot Nearby Items</label>
  <input id="auto-loot-enabled" type="checkbox" />
</div>
<div style="font-size: 12px; color: #aaa; line-height: 1.4;">
  Automatically attempts to pick up nearby loot while you move through it.
</div>
```

Step 2: Add UIManager state and persistence hooks

In `src/ui/UIManager.js`:
- store `this.autoLootToggle = document.getElementById('auto-loot-enabled')`
- store `this.onAutoLootChange = null`
- read localStorage key `eidolon.autoLootEnabled`
- expose:
  - `setAutoLootEnabled(enabled)`
  - `getAutoLootEnabled()`

Implementation pattern should mirror existing graphics setting persistence.

Step 3: Wire the checkbox to callback + localStorage

Behavior:
- on init, checkbox reflects saved state
- on change, persist and invoke `this.onAutoLootChange(enabled)` if present

Step 4: Re-run targeted settings tests

Run:
`cd /var/lib/hermes/eidolon-prs && npm test -- --runTestsByPath tests/UIManagerAutoLootSettings.test.js`

Expected: PASS.

Step 5: Commit

```bash
cd /var/lib/hermes/eidolon-prs
git add index.html src/ui/UIManager.js tests/UIManagerAutoLootSettings.test.js
git commit -m "feat: add persisted auto-loot setting"
```

---

## Task 3: Add loot interaction helpers and concise pickup feedback in GameEngine

Objective: Centralize loot pickup affordances, throttled failure handling, and success feedback.

Files:
- Modify: `src/core/GameEngine.js`
- Test: `tests/LootFeedback.test.js`

Step 1: Add failing tests for helper methods

Extend `tests/LootFeedback.test.js` to expect methods such as:
- `canAttemptLootPickup(entity)`
- `getLootPickupRadius(entity)`
- `shouldAutoLootEntity(entity)`
- `showLootPickupFeedback(entity, result)`

Step 2: Implement helper methods in `src/core/GameEngine.js`

Add methods:
- `getLootPickupRadius(entity = null)`
- `isLootEntity(entity)`
- `canAttemptLootPickup(entity)`
- `showLootPickupFeedback(entity, result)`
- `showLootFailureFeedback(reason)`

Suggested behavior:
- standard pickup radius around 2.5–3.0 units
- use concise floating text for success, e.g. item name or rarity-forward short label
- keep inventory-full feedback throttled to current one-second window
- optionally use UI/chat only for rarer or more important pickups; keep low-rarity success feedback lightweight

Example success payload:
```js
showLootPickupFeedback(entity, 'picked_up');
```
which may produce:
- floating text near player: `Picked up: Iron Sword`
or
- floating text near player: `Rare: Radiant Ruby`

Step 3: Improve `pickupLoot()` feedback flow

In `pickupLoot(lootId)`:
- keep the optimistic pickup gate
- if blocked by inventory space, call `showLootFailureFeedback('inventory_full')`
- on optimistic success, call `showLootPickupFeedback(entity, 'picked_up')`
- avoid repeated spam when the same loot item is retried too often

Step 4: Re-run targeted GameEngine loot tests

Run:
`cd /var/lib/hermes/eidolon-prs && npm test -- --runTestsByPath tests/LootFeedback.test.js`

Expected: PASS.

Step 5: Commit

```bash
cd /var/lib/hermes/eidolon-prs
git add src/core/GameEngine.js tests/LootFeedback.test.js
git commit -m "feat: improve loot pickup feedback and throttling"
```

---

## Task 4: Add nearby auto-loot scan in GameEngine

Objective: Let the player automatically pick up nearby loot when the optional toggle is enabled.

Files:
- Modify: `src/core/GameEngine.js`
- Test: `tests/LootFeedback.test.js`

Step 1: Write failing tests for the scan loop

Add test coverage for:
- auto-loot picks the nearest eligible loot within radius
- auto-loot skips loot when inventory is obviously full
- auto-loot does not repeatedly target the same impossible pickup every frame
- auto-loot ignores distant loot

Step 2: Implement scan helpers

Add methods:
- `findNearestLootInRange(radius = this.getLootPickupRadius())`
- `processAutoLoot()`

Behavior:
- only run when `autoLootEnabled` is true
- only consider active `LootDrop` entities
- skip loot already being removed / recently picked up
- use a modest scan interval/throttle so this is not a per-frame spammer
- when eligible, call `pickupLoot(loot.id)` directly if in radius
- do not override higher-priority combat/interaction state in a disruptive way

Suggested throttle state in constructor:
```js
this.autoLootEnabled = false;
this.lastAutoLootAttemptTime = 0;
this.autoLootAttemptCooldownMs = 250;
```

Step 3: Sync GameEngine state with UIManager setting

When the engine creates/binds UI:
- initialize `this.autoLootEnabled = this.uiManager.getAutoLootEnabled()`
- assign `this.uiManager.onAutoLootChange = (enabled) => { this.autoLootEnabled = enabled; }`

Step 4: Call `processAutoLoot()` from the update loop

Add it in a safe place after entity cache updates and before/alongside normal pending interaction processing.

Step 5: Re-run targeted tests

Run:
`cd /var/lib/hermes/eidolon-prs && npm test -- --runTestsByPath tests/LootFeedback.test.js tests/UIManagerAutoLootSettings.test.js`

Expected: PASS.

Step 6: Commit

```bash
cd /var/lib/hermes/eidolon-prs
git add src/core/GameEngine.js src/ui/UIManager.js tests/LootFeedback.test.js tests/UIManagerAutoLootSettings.test.js
git commit -m "feat: add optional nearby auto-loot"
```

---

## Task 5: Add stronger in-world loot readiness visuals

Objective: Make loot readability better before clicking so the player knows what is collectible right now.

Files:
- Modify: `src/entities/LootDrop.js`
- Modify: `src/core/GameEngine.js`
- Test: `tests/LootFeedback.test.js`

Step 1: Add failing tests for readiness state application

Add tests that expect loot visuals/readiness helpers to distinguish:
- in-range collectible loot
- out-of-range visible loot
- highlighted loot during pending interaction/autoloot targeting

Step 2: Add readiness API to `LootDrop`

In `src/entities/LootDrop.js`, add a small visual-state method, for example:
- `setPickupVisualState(state)` where state is one of:
  - `default`
  - `in_range`
  - `targeted`

Implementation guidance:
- avoid creating materials per frame
- update scale/emissive/opacity/label intensity conservatively
- keep text readable

Step 3: Update GameEngine to apply loot visual state

Add a pass such as `updateLootVisualFeedback()` that:
- marks nearby loot as `in_range`
- marks the current pending loot target as `targeted`
- resets others to `default`

This should be lightweight and only inspect active loot entities.

Step 4: Re-run targeted tests

Run:
`cd /var/lib/hermes/eidolon-prs && npm test -- --runTestsByPath tests/LootFeedback.test.js`

Expected: PASS.

Step 5: Commit

```bash
cd /var/lib/hermes/eidolon-prs
git add src/entities/LootDrop.js src/core/GameEngine.js tests/LootFeedback.test.js
git commit -m "feat: add loot pickup readiness visuals"
```

---

## Task 6: Full regression pass and manual verification

Objective: Ensure the new loot improvements feel good and don’t regress existing gameplay.

Files:
- Modify: `docs/plans/2026-03-31-loot-feedback-autoloot-plan.md` only if implementation notes need correction

Step 1: Run targeted tests

Run:
`cd /var/lib/hermes/eidolon-prs && npm test -- --runTestsByPath tests/LootFeedback.test.js tests/UIManagerAutoLootSettings.test.js tests/CombatIntentUI.test.js`

Expected: PASS.

Step 2: Run full JS suite and lint

Run:
`cd /var/lib/hermes/eidolon-prs && npm test -- --runInBand`
`cd /var/lib/hermes/eidolon-prs && npm run lint`

Expected: PASS.

Step 3: Manual verification checklist

Verify in-game:
- loot near the player visibly looks collectible
- clicking slightly near loot still feels forgiving
- in-range pickup works quickly and consistently
- inventory-full feedback appears once and does not spam
- auto-loot off => no automatic pickups
- auto-loot on => nearby loot is collected without annoying map-wide vacuuming
- combat interactions still feel normal while auto-loot is enabled
- rare/important pickups show satisfying but concise feedback

Step 4: Final commit if needed

```bash
cd /var/lib/hermes/eidolon-prs
git status --short
```

If follow-up polish was required:
```bash
git add <files>
git commit -m "fix: polish loot pickup feedback edge cases"
```

---

## Definition of done

- Loot pickup feels more reliable and forgiving.
- Players can tell when loot is in range and when it was successfully collected.
- Inventory-full failure feedback is concise and throttled.
- Auto-loot is optional, persisted, and limited to nearby loot.
- Existing click/interact/combat flows continue to work.
- Client tests and lint pass.

## Recommended branch / PR metadata

Branch name:
- `feat/loot-feedback-autoloot`

PR title:
- `feat: improve loot pickup feedback and add optional auto-loot`

PR summary bullets:
- add persisted auto-loot setting and nearby auto-loot scan
- improve loot pickup readiness visuals and concise pickup/failure feedback
- preserve server-authoritative pickup validation while reducing client friction
- add regression coverage for loot feedback and auto-loot behavior
