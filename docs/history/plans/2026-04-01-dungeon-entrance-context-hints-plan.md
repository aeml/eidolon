# Dungeon Entrance Context Hints Implementation Plan

> For Hermes: implement this plan incrementally on feat/dungeon-entrance-context-hints with focused tests before broad validation.

Goal: make dungeon entry points self-explanatory so players immediately understand what they are hovering, whether they can interact, and what action will happen before opening the dungeon menu.

Architecture: keep authority unchanged. The server still decides dungeon eligibility and actual entry. This PR is a lightweight client-facing UX layer that derives hover/interact context from the existing DungeonEntrance objects, current interaction distance, and existing get_dungeon_status flow. Reuse the current HUD/chat/UIManager patterns instead of inventing a new subsystem.

Tech stack: browser client JavaScript, existing GameEngine hover/interact flow, UIManager HUD rendering, Jest DOM/unit tests.

---

## Selected slice

After shipping objectives, combat intent, loot feedback, and boss reward summaries, the next highest-value gameplay improvement is the remaining roadmap item from Phase 1:
- quest markers and context hints for dungeon entrance

This is the best next PR because:
1. it is explicitly called out in docs/ROADMAP.md
2. the player already hovers and interacts with DungeonEntrance objects, so the hook points exist
3. it improves clarity before a dungeon run starts, complementing the newly improved reward clarity after a run ends
4. it is low risk and remains fully server-authoritative

---

## Desired UX

When the player hovers a dungeon entrance, show a lightweight hint panel near the HUD that answers:
- what dungeon this is
- what action is available right now (enter / move closer / party leader required / need party / open dungeon portal)
- optional prompt text such as “Click to interact” or “Move closer to interact”

When the player is in range of the entrance, the hint should reflect that.
When the player leaves hover or enters another instance, the hint should clear.
When the menu is opened via existing get_dungeon_status, the hint should disappear or remain non-conflicting.

The hint must not claim that entry is guaranteed; it should only describe local context and the interaction affordance.

---

## Likely files

Modify:
- /var/lib/hermes/eidolon-prs/src/core/GameEngine.js
- /var/lib/hermes/eidolon-prs/src/ui/UIManager.js
- /var/lib/hermes/eidolon-prs/src/styles/hud.css
- /var/lib/hermes/eidolon-prs/src/styles/responsive.css
- /var/lib/hermes/eidolon-prs/index.html

Create:
- /var/lib/hermes/eidolon-prs/tests/DungeonEntranceHints.test.js
- optionally /var/lib/hermes/eidolon-prs/tests/GameEngineDungeonEntranceHints.test.js if engine state logic needs isolated unit coverage

---

## Implementation tasks

### Task 1: inspect and codify entrance hint state
Objective: derive a small entrance-hint view model from the current hovered entity and local interaction range.

Steps:
1. In src/core/GameEngine.js, add helper(s) to detect a hovered dungeon entrance proxy reliably.
2. Add helper(s) to format local entrance hint data from hoveredEntity and player position.
3. Include fields such as:
   - dungeonType
   - dungeonName
   - inRange
   - actionLabel
   - promptLabel
4. Keep this entirely client-side and local.
5. Ensure the hint is cleared when hoveredEntity is null, player is null, or instance transitions happen.

Notes:
- reuse getInteractionRangeForEntity()
- reuse DungeonEntrance proxy userData.dungeonType
- keep labels lightweight and generic; do not promise server acceptance

### Task 2: render a lightweight dungeon entrance hint HUD panel
Objective: display the entrance context in a clear, unobtrusive HUD panel.

Steps:
1. Add a new container in index.html, likely near objectives/combat-intent panels.
2. In UIManager.js, add:
   - cached DOM refs for the new panel
   - updateDungeonEntranceHint(hint)
   - clearDungeonEntranceHint()
3. Render:
   - dungeon name
   - concise action/status text
   - prompt text
4. Hide the panel when there is no active hint.
5. Add CSS in hud.css and mobile adjustments in responsive.css.

Notes:
- fit the existing HUD language/style established by objectives and combat intent
- pointer-events should remain none to avoid blocking gameplay

### Task 3: wire engine hover/update lifecycle into the UI
Objective: keep entrance hints synchronized with hover and interaction state.

Steps:
1. Update GameEngine.performRaycast() flow so dungeon entrance hover refreshes the hint.
2. Update the general hover clearing path so the hint clears when the entrance is no longer hovered.
3. Refresh the hint during update when pendingInteraction points at a dungeon entrance and the player is moving into range.
4. Clear the hint on enterInstance() and destroy().
5. Ensure opening the actual dungeon menu does not leave stale hint state around.

Notes:
- do not let this interfere with combat intent or loot feedback
- if both systems could be active, entrance hints should only appear for hovered DungeonEntrance proxies

### Task 4: add focused tests first
Objective: lock down the intended behavior with minimal regressions.

Suggested tests:
1. UIManager renders and clears dungeon entrance hint content.
2. GameEngine derives “move closer” status when hovered entrance is out of range.
3. GameEngine derives “click to interact” / open portal status when hovered entrance is in range.
4. Hint clears when hover is removed.
5. Hint ignores non-entrance hovered entities.

Test approach:
- follow existing DOM-heavy test patterns from LootFeedback, CombatIntentUI, and QuestUIObjectivesPanel tests
- keep mocks lightweight by using Object.create(GameEngine.prototype) harnesses where practical

### Task 5: validate and ship
Objective: complete the full merge workflow once the feature is green.

Run:
- npm test -- --runTestsByPath tests/DungeonEntranceHints.test.js
- if a second engine test file is created, include it too
- npm test -- --runInBand
- npm run lint

Then:
- git add relevant files
- git commit -m "feat: add dungeon entrance context hints"
- git push -u origin feat/dungeon-entrance-context-hints
- gh pr create --base master --head feat/dungeon-entrance-context-hints ...
- gh pr checks --watch
- gh pr merge --squash --delete-branch
- verify local branch returns to master and status is clean

---

## Acceptance criteria

1. Hovering a dungeon entrance shows a HUD hint with the entrance’s dungeon name.
2. The hint distinguishes between in-range and out-of-range interaction states.
3. The hint clears when hover is lost, the player changes instance, or the engine is destroyed.
4. No server-authoritative behavior changes are introduced.
5. Jest and lint pass locally, and CI passes before merge.

---

## Out of scope for this PR

- actual server-side eligibility previews
- minimap room markers
- dungeon progress panel
- dynamic path guidance to entrances
- redesign of the dungeon menu itself

Keep this PR focused on pre-interaction clarity only.
