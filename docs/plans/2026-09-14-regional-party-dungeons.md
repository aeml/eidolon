# Remaining regional four-player dungeon acceptance

Continue the existing real-input party route; do not repeat the accepted
Verdant clear for these test-only extensions. The selected family now determines
the actual server-generated character/item level, target story chapter, boss
sequence and next manual offer. Normal entry levels: Abyssal 60, Molten 70,
Tempest 70, Umbral 100. At level 100, reward assertions include Resonance ranks/XP.

Each actor retains fourteen attainable, role-affixed items: five Rare and nine
Uncommon, zero potency. Strong Fighter, Wise Cleric, Brilliant Wizard, Agile
Rogue; no stat-scaling bonus or mid-run grants. Existing tank/heal/DPS input,
room/boss completion, individual credit, town recovery/re-entry, manual Ilyra
claims and persisted personal handoffs remain required. Existing isolation
guards restrict fixture preparation to newly registered empty local accounts.

These are **prepared-party encounter checks**, not earned regional campaign
progression or completed crystal raids. Later-region prerequisites are explicitly
seeded, with the selected dungeon chapter accepted but uncleared. The helper
checks its target against the real server catalog and expected final boss;
later chapters are not seeded. The already accepted Verdant fixture is retained.
Five-player minimum raid admission remains unchanged.

Focused validation: 35 JavaScript tests across three suites passed (1.634s),
normal generated item-stat budgets for all four roles at levels 30/60/70/100
passed in Go (0.034s), scoped lint/diff checks passed. Actual level-60 Go catalog
round-trip into all four JS builds passed: fourteen items each, Water dungeon
chapter active, next offer `chronicle_fire_cold_kiln`.

Next native target: Normal level-60 Abyssal Well, one fresh seed, four System
Chrome clients, no retries. Full native result is not yet established.

First attempt73535 on62fca4f9 is terminal failed before entry (1.4m). All four
builds replicated and invitation/support-roster UI passed, but the shared route
always requested a reset, then waited for the existing-run confirmation. This
new party has no instance; the actual UI only confirms discarding an existing
one. No combat, boss or seed evidence was produced. Archive:
`/tmp/eidolon-abyssal-party-20260914-v2vOO4/` (log, report, roster screenshot).
Owned services removed and ports released by wrapper.

Correction: preserve the shared route's existing reset default for reusable
actors, but explicitly disable the reset for this guarded newly-created party.
An entry-boundary regression checks that choice; no gameplay reset behavior,
party state, entry gate or combat assertion is changed.
