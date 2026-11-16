# Alpha1.26 — elemental assault and repair guidance

Separate local changes; exclude from Fire1.24 and Air1.25 publication:
QuestUI/CrystalVigil tests, ElementalRaidBriefing and its tests,
UIManagerDungeon, the endgame.css disclosure rule, raid-menu and
party-quest-tracker-layout browser changes,
and this record. No server combat, rewards, admissions or save changes.

## Demonstrated gap and correction

`buildDungeonRoutingObjective` previously handled only the `repairing` crystal
stage. A cleared assault with a `fractured` snapshot fell through to the normal
completed-dungeon “leave with your loot” message, even though Maelin's defense
was still pending. The server snapshot explicitly permits `fractured` after a
cleared guardian while a repair worker starts/resumes; boss death alone does
not prove restoration.

The tracker now keeps the player in the chamber for Maelin's Vigil when every
assault room is clear but the crystal remains fractured. Wave0 is “Preparing
the Vigil,” not a fictional first-wave counter. Restored snapshots direct town
recovery/exit and explicit personal Ilyra claims. This is route completion,
not a client-authored quest reward. Ordinary completed dungeons keep their
existing loot/exit message; in-progress repair and paused/regroup states remain.

## Four readable routes

Unlocked Guide cards now contain a collapsed, full-width “Guardian, Vigil and
personal rewards” disclosure, rather than only the ritual paragraph. The live
ground footprints still own avoidance; the guide is preparation, not combat
authority. Sealed cards retain their story-admission instructions.

| Raid / guardian | Authoritative warning and avoidance | Repair role |
| --- | --- | --- |
| Rootheart / Graven Colossus | SANCTUM FRACTURE; step sideways out of the fissure line | Hold Rootward8 seconds while allies keep attackers outside its outer ring |
| Tidestar / Tidebound Tyrant | CONFLUENCE SURGE; move away from the locked target pool | Carry two memories from the eastern font to Maelin per wave |
| Ember Crown / Ashen Imperator | CROWN ERUPTION; move between eruption pockets | Channel each bright vent in order for2 uninterrupted seconds |
| Skyglass / Tempest Sovereign | EYRIE STORMBREAK; safe center or beyond the marked ring | Four ordered anchors; a different raider takes the next, two may alternate |

Source: `elemental_raids.go`, `dungeon_telegraphs.go`, `crystal_vigil.go`.
Existing DungeonPreparation remains the ritual-copy owner. Briefings explain
that Maelin channels automatically, is not a quest giver, and requires BOTH
ritual completion and all attackers defeated through all three waves. Each
character checks their Chronicle and manually claims a ready repair quest with
Ilyra; raid loot and quest rewards remain distinct. No unconditional personal
credit promise for an absent/disconnected raider.

## Verification and limits

37 focused menu/briefing/Vigil/preparation checks passed4.158s; scoped lint and
whitespace pass. Tests cover all four guardian labels and exact server warning
copy, unknown/prototype names, stage transitions, personal-claim text and normal
dungeon exit compatibility. Three real-Chrome disclosure cases passed25.4s at
1280×720,390×844 and844×390. Each opened all four briefings, verified content and
horizontal fit and sent no raid/network action. Portrait and short-landscape
captures inspected at`/tmp/eidolon-126-raid-briefings/`: readable body scrolling,
fixed tabs and Close preserved. This is UI evidence, not an actual-phone raid.

Final CSS review confirmed phones hide BOTH hint lines. The restored compact
title now says “Return to Ilyra in town”; primary/detailed copy still explains
the explicit claim. Nine Vigil tests pass again.863s and scoped lint passes.
Three additional UI-only browser cases passed10.2s, showing fractured → preparing
→ restored transitions at desktop, portrait and short landscape. Portrait and
landscape captures inspected at`/tmp/eidolon-126-vigil-tracker/`: the full Ilyra
title fits without ellipsis and remains a journal button. The fixture disables
WebGL and does not start a game/account or claim a reward. The existing Guide
disclosure layout is unchanged by this tracker-text correction.

Existing server repair snapshots, restart/resume rules, three-wave objectives,
participant credit and manual claims remain untouched. The inherited Q06
encounter/Vigil/claim receipts in the1.11 gap register remain scoped as earned;
no gratuitous elemental raid replay or new long soak. Human pacing and real
party feedback remain playtest inputs, not manufactured measurements.

Remaining: integrate with predecessor releases, final focused packaging/version
and patch notes, mandatory delivery/live checks and exact public verification.

Final targeted re-entry check covers an uncleared guardian, paused repair,
leaving for town, returning to that paused snapshot, resuming wave two and a
restart's fractured snapshot. All remain incomplete until actual restoration;
town exposes no stale raid route. This exercises the client snapshot consumer,
not a new multiplayer raid. Seventeen Vigil/briefing checks passed in 1.262s.
The first attempt hit missing `structuredClone` in the Jest DOM environment;
using the fixture's existing JSON-copy pattern resolved that test-only setup.

Final packaging: login, client/server/container/QA/deploy versions and cumulative
notes are1.26.0. All344 focused version/Vigil/briefing/preparation/menu tests pass
4.711s, full repository lint and whitespace pass. Air1.25 is the currently
published candidate;1.26 remains local until that predecessor is accepted.
