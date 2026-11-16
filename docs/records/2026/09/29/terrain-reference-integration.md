# Terrain and combat reference integration — September 29

Local combined candidate based on c98020fd; runtime remains Alpha 1.38.0.
Not pushed or deployed. Ordered release gates remain unchanged.

## Integrated scope

Transferred the dependency-complete opt-in Earth elevation/rock profile:
shared generated surface and collision data, raised terrain and outcrops,
network profile negotiation/reconnect, scenery and actors, movement and
targeting, projectiles and ground effects, loot, server cover/navigation,
displacements and instance/entry recovery. Normal worlds remain flat; the
isolated QA terrain option requires an explicit account allowlist.
No damage, cooldown or reward rebalance. Cover changes apply only to the
opt-in profile. Audio and release-identity hunks remain excluded.

Preserved the clean candidate's already shipped 1.36–1.38 code and history.
Root git comparisons can label candidate-tracked files deleted when their
root counterparts are merely untracked: inspect actual files before making
any removal decision. No wholesale root staging/copying.

## Bounded verification

- Go elevation/grounding/rock selection passed (2.734s).
- Additional population/admin-teleport/dungeon-movement/whirlwind selection
  passed (1.930s); this is not a full dungeon clear or campaign validation.
- Both terrain/outcrop generators passed check mode.
- Initial client selection: 196 checks passed, one placement assertion failed.
  Fixed the test to distinguish shared tree geometry from scene-owned
  understory geometry, checking every plant matrix against real terrain and
  equivalent geometry attributes. Corrected placement suite passed.
- Nine related client suites then passed 94 checks with one old entrance
  assertion failing. That assertion incorrectly applied offset-masonry
  requirements to the new recessed opaque veil. Kept masonry requirements
  and asserted veil portal identity, double-sided opaque depth-writing
  material and shader identity separately. All 23 entrance checks then
  passed (5.668s). No production workaround or relaxed geometry tolerance.
- Scoped lint, Go formatting, shell syntax and diff whitespace passed.
- Disposable client/server phone combat: two orientations passed (21.0s).
  Negotiated terrain/outcrops, actual target selection, authoritative skill
  health loss, held movement/casting and basic contact/recoil checked.
  Credential scan passed; run-owned containers cleaned up.
  Run ID: terrainintegrated0929a; build identity c98020fd-dirty.
- Prepared production-render terrain preview: High/Low passed (10.9s).
  Artifacts: /tmp/eidolon-terrain-integrated-0929.
  This is not an authenticated campaign, physical phone or FPS acceptance.

## Visual assessment and next work

Inspected High grove terrain and Low danger/aura screenshots. Scenery and
effects conform to the same surface, but ground remains muddy, plant clumps
look repeated, rocks remain angular and fallback actors look procedural.
This is functional integration, not final Diablo/PoE-level art acceptance.
The earlier High performance gate remains open.

Owner reiterated that a compelling modern ARPG experience matters more than
version count. Updated the visual contract with normal-gameplay-view review,
cohesive scenes, responsive/weighty single-spec combat and fitted equipment.
Next: remaining audio integration and composition/material improvements in
the playable reference, followed by consolidated release review. No renewed
request for the deferred actor pilot; no campaign soak or repeated owner
gate question. Full roadmap goal remains active.
