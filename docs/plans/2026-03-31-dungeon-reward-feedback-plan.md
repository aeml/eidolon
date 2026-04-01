# Dungeon Reward Moments and Boss Drop Summary Implementation Plan

> For Hermes: Use subagent-driven-development skill to implement this plan task-by-task.

Goal: Make dungeon progress feel more rewarding by surfacing server-driven room-clear reward moments and concise boss drop summaries without changing combat or loot authority.

Architecture: Add a small server-to-client reward event path rather than inferring reward moments client-side from visual state. The server already knows when bosses die, when loot is generated, and which instance type/difficulty is active; it should emit compact reward summary events. The client should render these as lightweight floating text and HUD/chat notifications through `GameEngine` and `UIManager`.

Tech Stack: Go server (`server/internal/game/world.go`, `server/main.go`), vanilla JavaScript client (`src/core/GameEngine.js`, `src/ui/UIManager.js`), existing WebSocket message pipeline, Jest for client tests, Go tests where useful.

---

## Goals and constraints

- Preserve server-side authority for reward moments and loot contents.
- Reuse the existing `OnEvent` pipeline on the server.
- Keep the first slice focused on boss kill reward moments and drop summaries.
- Defer full per-room encounter-state tracking if the server does not already have reliable room-clear bookkeeping.
- Keep UI concise: one satisfying burst, not spammy repeated notifications.
- Ensure solo and party boss kills both work.

## Current code findings

- Server already emits world events for:
  - `elite_spawn`
  - `ability`
  - `damage`
  - `telegraph`
- Server boss-death handling already knows:
  - boss subtype
  - instance type
  - instance difficulty
  - generated loot items
  - whether reward distribution is solo or party
- Server currently gives boss heart rewards directly to inventory and emits `inventory_update`, but does not emit a player-facing reward summary event.
- Client already handles custom message/event types such as:
  - `chat`
  - `damage`
  - `combo`
  - `telegraph`
  - `enter_instance`
- Client already has rendering primitives for:
  - floating text (`FloatingTextManager`)
  - chat/system messages (`UIManager.addChatMessage`)
  - lightweight HUD panels (`combat intent`, `objectives`)

## Scope for this PR

In scope:
- server event payload for boss reward summary
- client handling for boss reward summary
- concise client feedback for dungeon boss kill rewards
- lightweight “boss defeated” and “rewards received” messaging
- regression tests for event handling and UI formatting

Out of scope for this PR:
- robust room-clear tracking across every dungeon room
- chest markers or fully new reward panel systems
- changing loot generation math
- non-boss dungeon completion UI overhaul

## Proposed player-facing behavior

When a dungeon boss dies:
1. player gets an immediate celebratory floating text moment
2. player gets a concise summary of rewards, such as:
   - boss defeated name
   - gold / XP bonus summary
   - notable generated reward counts (hearts/shards/items/gems)
3. party members each receive their own reward summary if eligible
4. summary comes from the server, not client guesswork

---

## Task 1: Add failing client tests for reward summary handling

Objective: Lock in the client behavior before implementing server/client plumbing.

Files:
- Create: `tests/DungeonRewardFeedback.test.js`

Step 1: Write failing tests for `GameEngine.handleServerMessage`

Cover:
- `reward_summary` event spawns celebratory floating text
- `reward_summary` event forwards a readable summary to `UIManager`
- non-boss reward payloads do not break handling

Suggested harness:
```js
const engine = Object.create(GameEngine.prototype);
engine.player = { id: 'player-1', position: new THREE.Vector3(0, 0, 0) };
engine.floatingTextManager = { spawn: jest.fn() };
engine.uiManager = { showRewardSummary: jest.fn(), addChatMessage: jest.fn() };
engine.handleServerMessage = GameEngine.prototype.handleServerMessage;
```

Step 2: Run targeted test to verify failure

Run:
`cd /var/lib/hermes/eidolon-prs && npm test -- --runTestsByPath tests/DungeonRewardFeedback.test.js`

Expected: FAIL because the event type does not exist yet.

---

## Task 2: Add client-side reward summary UI helper

Objective: Give the client a small dedicated place to format reward summaries consistently.

Files:
- Modify: `src/ui/UIManager.js`
- Test: `tests/DungeonRewardFeedback.test.js`

Step 1: Add a helper such as:
- `showRewardSummary(summary)`
- `formatRewardSummary(summary)`

Behavior:
- produce concise readable text
- reuse chat/system UI instead of building a whole new panel for this slice
- allow richer styling later without changing `GameEngine`

Suggested summary shape:
```js
{
  title: 'Boss Defeated: Zephyrion',
  subtitle: 'Tempest Spire • Heroic',
  gold: 4200,
  xp: 900000,
  itemCount: 3,
  gemCount: 1,
  heartCount: 2
}
```

Step 2: Have `showRewardSummary()` emit one or two concise chat/system messages

Example:
- `Boss Defeated: Zephyrion`
- `Rewards: +4200 gold, +900000 XP, 3 items, 1 gem, 2 hearts`

Step 3: Re-run targeted tests

Run:
`cd /var/lib/hermes/eidolon-prs && npm test -- --runTestsByPath tests/DungeonRewardFeedback.test.js`

Expected: still partially failing until `GameEngine` wiring exists.

---

## Task 3: Add client-side reward summary event handling in GameEngine

Objective: Consume a new server message and turn it into satisfying but concise feedback.

Files:
- Modify: `src/core/GameEngine.js`
- Test: `tests/DungeonRewardFeedback.test.js`

Step 1: Add `reward_summary` handling to `handleServerMessage`

Behavior:
- spawn a celebratory floating text burst near the player, e.g. `BOSS DEFEATED!`
- call `this.uiManager.showRewardSummary(summary)`
- keep handling resilient if some fields are missing

Step 2: Add optional helper methods to keep `handleServerMessage` clean

Examples:
- `handleRewardSummary(summary)`
- `buildRewardBurstText(summary)`

Step 3: Re-run targeted tests

Run:
`cd /var/lib/hermes/eidolon-prs && npm test -- --runTestsByPath tests/DungeonRewardFeedback.test.js`

Expected: PASS.

---

## Task 4: Add a server message type and payload for reward summaries

Objective: Create a formal transport for server-authored reward moments.

Files:
- Modify: `server/main.go`

Step 1: Add a new message constant

Add:
- `MsgRewardSummary = "reward_summary"`

Step 2: Add payload struct(s)

Suggested shape:
```go
type RewardSummaryPayload struct {
    PlayerID    string `json:"playerId"`
    Title       string `json:"title"`
    Subtitle    string `json:"subtitle,omitempty"`
    Gold        int    `json:"gold"`
    XP          int    `json:"xp"`
    ItemCount   int    `json:"itemCount"`
    GemCount    int    `json:"gemCount"`
    HeartCount  int    `json:"heartCount"`
    BossName    string `json:"bossName,omitempty"`
    InstanceType string `json:"instanceType,omitempty"`
    Difficulty  string `json:"difficulty,omitempty"`
}
```

Step 3: Extend `world.OnEvent` handling with a `reward_summary` case

Behavior:
- marshal the payload
- send only to the targeted player session, not broadcast to everyone

---

## Task 5: Emit reward summary events from server boss-death logic

Objective: Surface actual reward moments from the authoritative server boss kill path.

Files:
- Modify: `server/internal/game/world.go`

Step 1: Create a small server-side reward event struct near other event structs if needed

Suggested internal event data:
```go
type RewardSummaryEvent struct {
    PlayerID     string
    Title        string
    Subtitle     string
    Gold         int
    XP           int
    ItemCount    int
    GemCount     int
    HeartCount   int
    BossName     string
    InstanceType string
    Difficulty   string
}
```

Step 2: In boss-death reward distribution, count generated rewards

Use existing generated data to compute:
- item count from generated equipment loot
- gem count from generated gem loot
- heart count from boss heart generation
- gold / XP values already computed for the player/member

Step 3: Emit `reward_summary` after rewards are applied

For party members:
- send one event per eligible member

For solo:
- send one event for the attacker

Example title/subtitle:
- title: `Boss Defeated: Zephyrion`
- subtitle: `Tempest Spire • Heroic`

Step 4: Keep this server-side and additive

Do not alter loot drops or inventory behavior to support the summary.

---

## Task 6: Add or update tests for server and full client regression

Objective: Verify the whole flow and avoid regressions.

Files:
- Create or modify: `server/internal/game/..._test.go` if practical for event emission
- Test: `tests/DungeonRewardFeedback.test.js`

Step 1: If practical, add focused Go test(s)

Possible coverage:
- boss reward summary event is emitted with correct counts for solo kills
- party reward summary targets each eligible member

If the relevant boss reward logic is too entangled for a compact unit test, document that and rely on client/integration validation for this slice.

Step 2: Run targeted tests

Run:
`cd /var/lib/hermes/eidolon-prs && npm test -- --runTestsByPath tests/DungeonRewardFeedback.test.js`

And if Go tests are added:
`cd /var/lib/hermes/eidolon-prs/server && go test ./internal/game -run 'RewardSummary|BossReward'`

Step 3: Run full regression

Run:
`cd /var/lib/hermes/eidolon-prs && npm test -- --runInBand`
`cd /var/lib/hermes/eidolon-prs && npm run lint`
`cd /var/lib/hermes/eidolon-prs/server && go test ./internal/game`

Expected: PASS.

---

## Definition of done

- Server emits player-specific reward summary events for dungeon boss kills.
- Client renders a satisfying boss reward moment without adding spam.
- Reward contents are server-authored, not guessed client-side.
- Solo and party reward summary paths both work.
- Tests pass and branch can be PR’d and merged back to master.

## Recommended branch / PR metadata

Branch name:
- `feat/dungeon-reward-feedback`

PR title:
- `feat: add dungeon boss reward moments and summaries`

PR summary bullets:
- add server-authored reward summary events for dungeon boss kills
- surface concise client reward feedback via floating text and chat/system UI
- preserve server authority while making boss rewards feel more immediate
- add regression coverage for reward summary handling
