# Quest conversations, town collisions, and cherub guardians

September 5, 2026. Local, unreleased follow-up to Alpha 1.0.1. Player-facing
notes are under **Unreleased** in the in-game patch history; the published
version has not been changed or deployed by this work.

## Behavior

- Archmage Ilyra stands in the open at `(20, 215)`, separate from the daily
  giver at `(-20, 200)`. Story markers are gold; daily markers are blue.
  Ready-to-turn-in `?` takes priority over available `!`. Neither NPC is hostile.
- New characters are offered the Chronicle and directed to Ilyra. Acceptance
  and completion require explicit clicks and server-checked giver proximity.
  Objective progress alone grants neither chapter completion nor XP. Collection
  items are checked and consumed at turn-in. Existing saved progress is retained.
- Fifteen authored completion conversations appear after server acknowledgement.
  The next chapter is offered, not automatically accepted. Existing four dungeon
  roads, four raid-clearing/crystal-defense Vigils, and Dark Realm gates remain.
- The tracker prioritizes the story, limits visible cards, and links to all
  objectives in the Journal. Short displays compact secondary cards; permanent
  chat keeps its space. Narrow quest windows scroll to the completion control.
- Trading house, stash coffer, and Oathhall use current local wall footprints.
  Rotated walls resolve in their own coordinate frame, without historical model,
  roof, or name-label padding. Removing service entities removes their colliders.
- Guardians are classical non-explicit cherubs: rounded bare bodies, curls,
  little feathered wings, and halos. Batched shared geometry limits draw calls;
  wing animation works at both quality settings. Aura radii, three/five guardian
  variants, runes, lifetime, and server-owned damage are unchanged.

## Verification

- Full client suite: 144 suites, 2,086 tests passed before the final
  lost-acknowledgement reopening regression was added; focused quest checks
  cover that follow-up. Lint and whitespace checks pass.
- Full server `go test -race ./...` passes. Tests exercise explicit completion
  across all 15 chapters, no automatic rewards, correct NPC/range/instance,
  duplicate claims, collection inventory, repair completion, and saved progress.
- A server race run exposed pre-existing social-broadcast test teardown racing
  its asynchronous sender. Both affected tests now wait for every recipient
  using the existing synchronization helper. Twenty repeated race runs of the
  social-status tests pass; production social handling was not changed.
- Fresh disposable Mongo/server browser route passes using real mouse input:
  walk to Ilyra, accept the offered story, return across town, accept a daily,
  verify chat after Escape. Read-only checks against the fully loaded town
  verify clear trading-house/stash approaches and blocking masonry/coffer faces,
  including the presence of exactly three current oriented colliders.
- Two presentation browser tests pass: manual completion and dialogue with
  simulated acknowledgement; 27 objectives at 1440×1000, 1280×600, 390×844,
  and 320×640; production NPC markers and cherub model. The UI fixture is not
  evidence of a real-server quest turn-in. Server unit tests cover turn-in rules.
- Reviewed cherub/marker close-up and short-desktop/narrow-phone quest captures.
  Temporary images are in `/tmp/eidolon-quest-town-cherub-reviewed/`; regenerate
  or preserve them as release artifacts before relying on durable screenshots.
- Two-account isolated multiplayer passes: remote Spirit Guardians refresh,
  join-in-progress reconstruction, authoritative expiration and cleanup, plus
  remote movement, jumping, basic attacks, and ability presentation. Temporary
  QA containers/data were removed by the runner; production accounts were not used.

## Repeatable commands

```sh
npm test -- --runInBand
npm run lint
# From server/:
go test -race ./...
# From repository root; disposable containers and generated QA accounts:
EIDOLON_E2E_WEB_PORT=4373 EIDOLON_ISOLATED_QA_ROUTE=quests npm run test:e2e:isolated
EIDOLON_E2E_WEB_PORT=4373 EIDOLON_ISOLATED_QA_ROUTE=multiplayer npm run test:e2e:isolated
EIDOLON_E2E_WEB_PORT=4473 npx playwright test tests/e2e/quest-town-polish.spec.js
```
