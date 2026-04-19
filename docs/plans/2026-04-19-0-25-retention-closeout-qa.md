# Eidolon 0.25 Retention Closeout QA

Last refreshed: April 19, 2026 (`0.25.4`)

Purpose: record the targeted manual QA route for the real retention loop shipped in `0.25`.

## Scope

Validate the sticky loop that now exists in code:

- party reward-sharing and bonus visibility
- dungeon rerun ladder visibility
- journal repeatable ladder and authoritative reset timing
- trading house browse/list/collect flow

This is not a weekly-system checklist. No weekly system exists yet.

## Recommended QA route

Run this route in a normal browser session with at least one max-level character.

1. Open Help and confirm the Daily Return Loop section accurately describes the real flow.
2. Open Journal (`J`) and confirm the Repeatable Ladder is visible before accepting every daily.
3. Verify the Journal reset readout shows a live ET countdown instead of static text.
4. Leave the Journal open across at least one server time tick and confirm the countdown refreshes.
5. Check that top dailies clearly read `Active`, `Ready`, or `Available`.
6. Open the Dungeon Guide and confirm the rerun ladder still matches the chosen dungeon and difficulty.
7. Form a party and confirm the party panel still explains nearby reward sharing and the live per-member bonus.
8. Run a dungeon with a party and confirm the stated reward-sharing/value proposition still feels truthful in play.
9. Open the Trading House and validate browse timing, listing guidance, and collection outcomes still read clearly.
10. Turn in any `Ready` dailies, reopen the Journal, and confirm the ladder still shows the next best route instead of going silent.

## Record during QA

- any place where the loop becomes unclear
- any mismatch between Journal, Dungeon Guide, Party UI, and Trading House messaging
- any countdown/timezone confusion
- any retention copy that overpromises systems that do not exist yet

## Current recommendation

Recommendation: `0.25` is now represented coherently in code and player-facing UI, but the release should still be treated as needing this explicit live QA pass before being considered fully closed.
