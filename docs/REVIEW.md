# Eidolon Review

Last refreshed: April 2026
Reviewed against current `master` after the recent dungeon progression, menu polish, and jump/shadow polish passes.

## What the project is today
- Static browser client loaded from `index.html` and ES modules
- Vanilla JS / Three.js client coordinated by `GameEngine`
- Authoritative Go server with protobuf state streaming and MongoDB persistence
- A large playable feature set already exists: classes, quests, loot, forge, trading, party play, four realms, and four instanced dungeons
- The game now has a noticeably stronger UX baseline than earlier revisions: combat intent, objectives, entrance hints, room-state feedback, menu close fixes, better death/respawn messaging, and better movement/render feel

## What is working well
- Dungeon progression model is much clearer than before: unlock-at-30, run-level selection, endgame difficulties at 100
- Client/server jump authority is covered and synchronized
- Render pipeline quality is improved, especially around stable shadows and movement readability
- UI surface area is still large, but it is no longer concentrated in a single 5k-line monolith
- Test coverage is strong enough to support aggressive polish passes without flying blind

## What is still fragile
- Instance transitions still rely on broad scene rebuild behavior instead of explicit scene groups
- Some HUD/UI surfaces still update more often than necessary, which risks DOM churn and mobile jank
- Mesh/content definition work is only partially data-driven; some additions still require touching fragile condition trees
- The game has many good feedback systems now, but dungeon pacing/replay-value is still more procedural than authored

## Best next improvements
1. Scene-group based instance cleanup and transitions
2. UI diffing/throttling for high-frequency HUD updates
3. Continued MeshFactory/catalog cleanup
4. Dungeon pacing and room-role identity pass
5. Repro/sandbox tooling for fast manual QA
6. Audio/accessibility/onboarding improvements once the above are safer

## What should not be treated as current problems anymore
- Three.js runtime/test mismatch: fixed
- Missing input teardown: fixed
- Missing combat-intent/loot/objective guidance baseline: fixed
- One-dungeon/two-zone project framing: stale and no longer accurate
- “Switch from JSON to protobuf” as future work: stale; protobuf state streaming is already live
