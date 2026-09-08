# Collection input correction — candidate, not first-hour approval

The read-only d31334a diagnostic records authoritative attacks and damage landing
on other Skeletons and level30 Demon Orcs while the test still waits for its
original Skeleton. Its repeated healthy retreats take it hundreds of units from
the starter area. At this entry40009 is still running unchanged; this correction
is developed in a separate worktree, not over that frozen source.

Collection now reads the actual hostile pending interaction after an ordinary
left click and follows that enemy. It never assigns a runtime target or sends
combat messages directly. Switching the observation does not reset the120-second
encounter deadline; a living target cannot count as defeated. Loot approach still
uses the actual observed death position and real pickups/manual handoff remain
required. The two-respawn and20-minute route bounds are unchanged.

Only the collection driver opts into retreating below80% health. Healthy heroes
can trade ordinary hits instead of endlessly moving the pack. Shield availability,
collision-aware retreat and actual movement requirements remain; other hunt and
dungeon drivers retain their previous spacing policy. This changes QA input
strategy, not player/enemy stats, regeneration, rewards, drops or terrain.

Focused22496 passes30tests/four suites/2.201s plus full lint/diff checks. New tests
cover actual hostile selection without state mutation, healthy trading, injured
retreat, shield priority and preservation of default hunt spacing. An actual run
is required after40009 has closed; no collection or broader pacing approval yet.

Actual82761 ona47dc7d failed5.4m: five observed target deaths,2/8 seeds, zero
deaths, then120s encounter timeout. Scan0/cleanup passed; its image was viewed
and archived at `/tmp/eidolon-release47-input-evidence-pMenOr/failed-collection.png`.
The input correction did not establish pacing; below80% health repeated retreat
still spreads the fight into more enemies. No unchanged retry is approved.

Source inspection confirms GameEngineRuntime already retains a clicked target
for automatic cooldown-driven attacks. Collection now leaves that valid pending
interaction intact instead of replacing it every250ms. It reacquires through an
ordinary click only after that interaction changes/cancels. Actual state is also
rechecked after defensive movement and across reacquisition, before changing the
observed ID, so a delayed killing hit cannot be silently skipped there. These are
test inputs/observations, not grants or direct target assignments;120s, two deaths,
20m, real loot and manual turn-in remain unchanged.

Initial62305 failed one unsupported Jest matcher (32 other tests passed); the
same assertion is expressed as separate count/argument checks. Corrected81770
PASS33tests/four suites/1.451s plus full lint/diff checks. Actual play is due.
# Opening-route follow-through

The bb36a64 collection run13265 failed before collection: two opening Skeleton
kills, zero deaths, then the unchanged120-second encounter deadline. Cleanup
and an independent container-absence check passed. The opening still used the
older unconditional8-unit retreat and repeated target clicks, so it did not
exercise the corrected collection controls. This is not collection approval.

The opening now shares ordinary health-aware defense and retained auto-attack
selection with collection. Actual quest credit, manual turn-in, two-respawn
limit,120-second encounter and overall deadline are unchanged. Read-only combat
receipts now cover opening failures, including actual stats.hp and target IDs.
Focused48431 passes35tests/four suites; full lint10527 passes. A fresh actual run
is required; no production combat or reward values changed in this correction.
