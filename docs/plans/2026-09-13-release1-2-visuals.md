# Alpha 1.2.0 — working release notes

Local implementation in progress, not published. Keep the full 1.2 roadmap scope;
these entries describe implemented changes, not milestone completion.

## Player-facing changes prepared

- Phone Forge equipment selection uses readable named rows, visible level and
  potency, larger controls and collapsible help. Desktop retains its icon grid.
- Exposed Rogue, Wizard and Cleric faces are smoother. All four heroes have
  visible wrist grips that remain when equipped gloves replace their defaults.
  Shared geometry keeps the hands to one additional mesh each.
- Phone Trading House inventory has named rows, quantity and selection feedback.
  Selling uses a stacked form; auction controls have at least 44px touch targets.
  Auction item stats and descriptions can be expanded without hovering. Listing
  identity/quantity validation and existing transaction callbacks are retained.
- Touch settings now save left/right-handed action placement and 100–120%
  control sizing independently of menu text. The camera's unobstructed region
  follows those controls, and very short landscape uses standard size to preserve
  viewing space. Phone and desktop camera zoom save independently across sessions.
- Phone social/friend/guild lists use readable cards and touch-sized actions.
  Guild roster management is tucked into a named Manage disclosure while retaining
  permission checks and callbacks. PvP challenges, scores and leaderboard entries
  use readable text and scroll within the screen.

## Focused evidence

- Forge: 14 tests, short 390px Chrome layout/click check.
- Hero models/equipment: 222 tests; four-class static before/after render inspected.
- Trading: 82 tests; actual TradingUI with production HTML/CSS in short 390px
  Chrome preview. Fixed form overflow and low-contrast text found in that preview.
  Rows are 318px wide, 72–94px high, without horizontal content overflow.
- These previews use fixtures, not production economic transactions or physical
  phone sign-off. Exhaustive matrices remain deferred under the delivery policy.
- Touch/settings: 29 focused settings tests and 20 camera/settings tests pass
  (overlapping suites, not 49 unique tests). Short Chrome checks at 390×844,
  844×390 and 568×320 cover both hands at the largest selected size: all movement,
  action and hotbar targets are in bounds, at least 44px and hit-test reachable.
- Community: existing guild/friends/PvP 49 tests pass, plus the focused guild
  rerun (5) checks the new disclosure. Actual SocialUI/GuildUI/PvPUI previews at
  390×844 inspected, with no horizontal guild/PvP window overflow.

## Remaining milestone work

Continue four-class anatomy/hair/silhouette/movement and equipped animation fit,
remaining phone menus and actual gameplay-scale composition/readability.
Then consolidate player-facing patch notes into login/release metadata, publish
1.2 after 1.1, and run basic deployment/live smoke. Do not publish this worktree
before the predecessor's deployment is confirmed.
