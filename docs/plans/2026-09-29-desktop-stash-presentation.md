# Desktop stash presentation — 1.45 candidate

One desktop storage window now shows Bag and Stash side by side, replacing
the separate bag window and icon-only storage grid. Named rows use item icons
and rarity accents, with occupied capacity, search and category filters.
Each pane scrolls independently. Long names wrap and the window fits shorter
desktop screens. Phones retain the existing tabbed storage interface.

Click/keyboard activation opens read-only item details with an explicit
transfer action; right-click retains the quick transfer request. Filtered rows
keep original slot indices and revalidate identity before requesting a transfer.
Quest-item protection, capacities, stack rules and authoritative server responses
remain unchanged. Live refresh preserves reading position and returns focus to
the updated row or source pane when an inspected item disappears.

Verification: 108 tests in seven focused storage, inspection, readiness and
menu suites passed (29.39s). Two existing desktop browser cases at 1440x900 and
1024x600 passed (24.5s), extended with full 25/100-item panes, bounds/overflow,
filtered slot99 withdrawal, right-click deposit, read-only inspection and live
detail/focus refresh. Both stash captures were inspected in
`/tmp/eidolon-stash-review-0929`. Scoped lint and whitespace checks passed.
No extra browser cases or long campaign run were added. Earned preparation
helpers use the new visible controls while retaining their server-state
conservation checks; no real economic transfer or earned dungeon route was run.

An additional29 existing inventory/service-close and HUD diff/managed-window
checks passed (3.386s), for137 focused unit checks in total.

This is local candidate work, not a deployed release or final interface/art
acceptance. Runtime version remains1.38; earlier milestone gates remain open.
The connected world/combat quality target and full roadmap remain unfinished.
