# Quest, lore and window quality

Owner requirement added October 15, 2026. **Required before beta; open.** Improve
the whole quest experience and bring game menus up to the visual quality of the
improved world. Existing functionality is a foundation, not final acceptance.

## Quest tracking and conversations

- Make the current task immediately understandable: what to do, why it matters,
  objective progress, where to go and whom to return to. Distinguish main story,
  optional quests and repeatable contracts without overwhelming the HUD.
- Improve pin/unpin tracking, selected-objective focus, map/journal navigation,
  readable progress updates and the ready-to-turn-in state on desktop and phone.
  Preserve the player's tracking choices across updates and reconnects.
- Improve NPC quest browsing, acceptance, in-progress dialogue and turn-in as
  one coherent flow. Clearly show speaker, context, objectives, rewards and next
  action. Acceptance and claiming rewards remain explicit player actions.
- Handle pending, rejected and successful server responses visibly. Avoid lost
  selection/scroll, duplicate actions, premature completion displays and accidental
  acceptance of the next quest. Preserve earned rewards and manual story handoffs.

## Lore book and story recall

- Provide an easily discoverable lore book with a concise **Story so far** recap
  and **What I'm doing now** section linked to the current quest and map.
- Organize earned chapters, people, places and discoveries with clear navigation
  and readable detail pages. Allow rereading completed story and important NPC
  dialogue/context without requiring the player to remember where it occurred.
- Derive unlocked content and recap from actual saved progress. Do not reveal
  future chapters, discoveries or outcomes. Explain current stakes and next
  steps rather than presenting only a raw completed-quest list.
- Preserve optional/legacy discoveries and returning-save progress. Future lore
  and unearned memories must not appear merely because static content exists.
- Connect the tracker, quest journal, conversations and lore book so returning
  players can recover both their narrative context and immediate next action.

## Remembered menu positions and visual polish

- After a player drags a window, closing and reopening it restores that position.
  Cover character, bags/inventory and stores first, then the shared draggable
  window system, including stash, forge, trading and quest/journal windows.
- Automatic companion layouts, content refresh and resize observers must not
  overwrite a deliberate dragged position on the same viewport.
- Keep restored panels and their close/drag controls reachable after resizing,
  browser zoom or desktop/phone changes. Phone layouts retain usable sizing,
  scrolling and touch targets rather than inheriting offscreen desktop offsets.
- Provide a predictable layout reset. At minimum preserve positions across
  close/reopen within a session; durable browser-local preferences are the
  implementation direction, with graceful handling of unavailable storage.
- Improve typography, spacing, framing, materials, tabs, icons, item/reward
  hierarchy, tooltips, preview presentation and action states across character,
  inventory and store windows, then related shared surfaces. Keep a coherent
  dark-fantasy visual language and readable contrast rather than adding clutter.
- Preserve keyboard/focus behavior, accessible labels, touch access, drag versus
  click discrimination, safe-area handling and usable low-resolution layouts.

## Existing foundations and known gap

`QuestUI.js` already provides tracking preferences, a Chronicle recap, recovered
lore and discovery records; `QuestConversation.js` owns manual quest dialogue
and completion replies. Build on these and authored Chronicle content rather
than duplicating progression state or presenting old functionality as new work.

At the initial request, `UIManagerWindows.js` already clamped panels to the viewport
and observed content size. Its service/companion reflow unconditionally recentered or re-paired some
windows; the generic dragged-window guard alone does not protect those paths.
Inspect drag completion, reopening and session teardown before selecting a fix.

## Acceptance checklist

- [ ] Finish quest tracker, journal and NPC conversation redesign end to end.
- [ ] Deliver a navigable lore book with earned recap and current task context.
- [ ] Complete representative fresh, mid-story, returning, optional-catch-up and
  finale states without spoilers, lost progression or misleading rewards.
- [ ] Restore dragged window positions through close/reopen, paired windows,
  store interactions and changing content; verify resize and phone recovery.
- [ ] Finish coordinated character, inventory and store presentation polish.
- [ ] Exercise actual mouse, keyboard and touch flows in desktop/phone browser
  views; retain focused regression and screenshot evidence for changed behavior.
- [ ] Publish and verify the selected milestone. Final usability/visual review
  remains distinct from unit/browser checks and from deferred physical playtests.


## First scoped correction — October 15

Automatic centering and companion pairing now preserve dragged positions across
close/reopen in the current UI session.79 focused checks and one real-browser
mouse/reopen/content-resize/viewport-resize case pass. The initial browser
fixture failed at cleanup on the wrong disposal method; corrected cleanup passes
with unchanged layout assertions. [Qualification](2026-10-15-window-position-qualification.json).
This correction is selected locally, not deployed. Durable preferences, layout
reset, full phone policy and the broader quest/lore/menu redesign remain open.

## Quest experience implementation — October 15

A dedicated searchable Lore Book now presents earned chapters, exact recorded
discoveries, restoration accounts, Ilyra replies, story recap and current task.
It links back to the current quest and map, retains in-session reading choices
and clears old-character state. Tracked cards open the corresponding journal
section by keyboard or touch. NPC review now leads with state/objective/reward,
preserves paragraph breaks and keeps manual actions reachable through long
dialogue. Pending, rejected and acknowledged transitions retain their rules.

227 distinct focused checks and13 distinct native UI cases have passing evidence;
full lint and reviewed desktop/phone captures qualify this local selection.
[Evidence, stale fixture and invocation failures](2026-10-15-quest-book-qualification.json).
Publication follows acceptance of54. This does not close shared-menu polish,
durable position/reset preferences, physical playtests or final owner review.

## Durable layout implementation — October 15

Dragged registered windows now save device-local positions across reloads, with
separate wide and compact desktop layouts. Temporary content/viewport clamping
does not overwrite the saved coordinates; expanding restores the prior layout.
Phone sessions retain their responsive default layout and ignore desktop offsets.
Settings includes a keyboard/touch-accessible Reset window positions action that
clears saved layouts and recenters the current panels. Unavailable/malformed
storage falls back gracefully. Drag listeners retire with their UI session.

94focused checks and five distinct native cases pass, retaining the initial
accessible-name failure and corrected desktop/phone evidence.
[Qualification](2026-10-15-durable-window-layout-qualification.json).
This selection closes the implementation gap for durable registered-window
positions/reset; broader menu polish and final usability review remain open.
