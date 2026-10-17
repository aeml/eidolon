# Dungeon entry finish and Lore Book reading continuity

Qualified source: `583b366a4b354825096b02e161f223ca1b82430b`.
Base: prepared Alpha1.79.76, `b75b0d621320a2b99f03cdb0590d351ee6c8d221`.
This candidate is qualified locally. Publication follows exact76 acceptance;
it is not a deployed or beta-ready claim.

## Player behavior

Dungeon entry stone and iron use the existing nearby prop maps with physical
texture density and valid bevel charts. Geometry, shadows, collision data and
doorway state are preserved. [Entry qualification](2026-10-17-dungeon-entry-surface-finish.md).

The Lore Book also keeps its reading heading when a newly earned account
enriches a person's name or the return link to an earlier memory. Previously,
rebuilding the article removed its focused heading. The reader's keyboard focus
fell to the game page, interrupting navigation even though the selected memory
had not changed. Reusing the article heading preserves focus through both direct
book updates and the QuestUI detach/reattach cycle. An outside control retains
its focus. Search, selected memory, receipts and manual quest actions are unchanged.

## Lore evidence

Three new client cases cover a direct reference-page refresh, a personally
learned fuller name in the journal and an outside-focus control. The original
implementation fails both focused-heading cases while the outside control passes;
twelve unchanged cases are skipped in that targeted negative run. All80checks
across LoreMemoryIndex, LoreBook and QuestUIObjectivesPanel pass after the fix;
lint passes for the runtime and both changed tests.

Two System Chrome cases pass without retries/skips/flakes, using desktop1280
and phone390browser layouts. The desktop activates the person using Enter;
the phone uses touch. Both retain the focused heading, search and exact journal
reading scroll when personal evidence expands the page, and retain the existing
read/return, no-spoiler, no-progress-mutation and close/reopen checks. Desktop and
phone learned-name captures were inspected. These DOM/CSS checks do not certify
WebGL performance or physical-phone usability.

Frozen18file lore inventory:
`/home/aeml/.local/share/eidolon-lore-focus-review-20261017/.qa-lore-focus/qualified-evidence-inventory.json`,
SHA256 `dcc2172d881658e2d2934ded006cc373050a97bbecbf0235cfcd21efdf8753ee`.
It verifies the original four-file negative packet,
`a04641d932f0e829f353edab98dc311af4d8edec67b2f3c436207da4c6fadd3b`,
and the initial two-case passing browser packet,
`746befdd4744ba1fdc4d622c70a608bd9336cb7f4edc42b1c98430ce33623d03`.
The latter is retained separately: the final observer additionally exercises
actual Enter activation and captures the updated heading visibly after verifying
preserved scroll. No runtime, deadline or quality target changed between those
two browser observations; passing cases are counted once.

## Assembly and release preparation

The selected runtime is exactly three paths: DungeonEntryWard,
ProceduralDungeonInteriors and LoreBook. Five test paths change. The component
runtime and test bytes match their frozen qualified sources; no lighting,
skeleton-borrowing or shader experiment is selected. The canonical179507byte
geometry worker remains unchanged.

The frozen11file assembly inventory is
`/home/aeml/.local/share/eidolon-lore-focus-review-20261017/.qa-entry-lore-assembly/qualified-evidence-inventory.json`,
SHA256 `77ab6071a89d936edc816fce7cac48989b1725c80b6699b1464b6336e36a1b09`.
It verifies the full58file entry and18file lore inventories and each selected
runtime/test path. Evidence is reused across disjoint component scopes:144distinct
focused checks/six suites and four distinct browser cases, including twenty
entry RGBA comparisons. No extra full native replay is claimed.

Expected next full client:802suites/12434tests; engine513modules. No new browser
case is added. Exact release CI, cumulative notes, public identities/assets and
deployment acceptance remain required after ordinary master merge/publication.

## Remaining scope

Broader sparse-room/repeating-floor composition, moving world/combat quality,
frame-time/device targets, final collection/menu/owner review and every original
game/readiness/F1-F5/beta/1.99 gate remain open. Human campaign/physical-phone
feedback and soak/stress stay deferred, not passed. Public access, server rules
and supplied actor/equipment assets are unchanged by this candidate.
