# Eidolon 0.22 First-Hour Closeout

Last refreshed: April 18, 2026 (`0.22` closed for implementation, live QA still recommended)

Purpose: record the explicit closeout checklist for `0.22`, what was shipped during the slice train, what still requires live QA, and the current recommendation on whether `0.22` is ready to close.

## Scope of `0.22`

`0.22` is the first-hour onboarding and readability release.

It is meant to answer these questions clearly for a new player:

- Where do I go first?
- What do I click if I get lost?
- What should I sell versus keep?
- What just happened in combat?
- What unlocks next?

It is not meant to deliver guilds, PvP, or long-tail endgame systems.

## Shipped slices in `0.22`

- `0.22.0` to `0.22.7`: start-screen onboarding, town-service anchors, quest funnel clarity, first-dungeon handoff, and starter economy guidance
- `0.22.8` to `0.22.14`: dungeon route truthfulness, boss-state guidance, extraction framing, and objective language cleanup
- `0.22.15`: starter loot and forge-material explanation
- `0.22.16`: early combat readability for failed attempts, level-up payoff, and reward surfacing
- `0.22.17`: nearby multiplayer combat readability in crowded fights
- `0.22.18`: nearby remote-player motion readability for jumps and attacks
- `0.22.19`: first-hour milestone guidance in start flow and Help screen
- `0.22.20`: post-level-30 and post-level-100 town guidance so the route stays readable after the first unlock band

## Release-gate status

### Gate 1: Fresh-login through first meaningful dungeon-ready milestone feels coherent end to end

Status: mostly implemented, still needs live QA confirmation

Evidence:

- start flow now points toward Quest Giver, Forge, Vendor / Repair, and early dungeon progression
- town recovery guidance exists after recall, respawn, and return to town
- Help screen now includes first-hour milestones and unlock beats
- town objective guidance now covers pre-30, post-30, and post-100 town states

Still needed:

- a real fresh-account browser run from register to first dungeon-ready milestone
- a written list of any dead spots or confusion discovered during that run

### Gate 2: New players can recover their next step without guessing or leaving the client

Status: implemented in-client, still needs live QA confirmation

Evidence:

- start flow
- objectives panel
- journal
- world map
- minimap
- Help screen milestone guide
- town recovery objective after common funnel breaks

Still needed:

- verify recovery behavior under live play after death, recall, menu-close, and town return

### Gate 3: Early combat and interaction feedback feels readable under real play

Status: strong in code and tests, still needs live QA confirmation

Evidence:

- out-of-range, cooldown, and mana-failure callouts landed
- level-up and reward callouts landed
- crowded multiplayer and remote-motion readability landed

Still needed:

- one live play session to make sure the feedback is helpful instead of noisy

### Gate 4: Early loot, materials, and item decisions are understandable

Status: implemented in-client, still needs live QA confirmation

Evidence:

- inventory guidance
- starter tooltip guidance
- merchant/stash/forge/trading explanation pass

Still needed:

- verify that a real new player can infer what to vendor versus keep without outside explanation

### Gate 5: A targeted first-hour live QA pass is completed and written down

Status: not completed yet

This is the biggest remaining blocker to declaring `0.22` complete.

## Recommended live QA route

Run this route in a normal browser session:

1. Register a brand-new account
2. Create a fresh character
3. Enter town and follow the first objective path
4. Check whether Quest Giver, Forge, Vendor / Repair, Stash, World Map, and Journal agree on the route
5. Intentionally close menus and recover using only in-client guidance
6. Take an early death or force a respawn and confirm the route is still recoverable
7. Recall to town and confirm recovery guidance still makes sense
8. Reach the first dungeon-ready milestone and note any ambiguity
9. Validate that loot, forge materials, and upgrade expectations make sense during the route

Write down:

- where confusion still exists
- whether the route ever goes silent
- whether combat feedback is readable in actual play
- whether any guidance is redundant, noisy, or misleading

## Current recommendation

Recommendation: `0.22` is feature-complete in code, but should not be formally closed until the live QA pass above is completed and recorded.

Release review decision:

- no further planned `0.22.x` feature slices are recommended
- remaining `0.22` work is QA confirmation and any tiny follow-up fixes that QA might reveal
- if QA is clean, close `0.22` and move directly into `0.23`

Implementation status:

- `0.22` is now closed for planned implementation work
- active feature development has moved to `0.28.3`

If the live QA pass reveals a real onboarding dead spot, ship one last small `0.22.x` cleanup patch and then close it.
