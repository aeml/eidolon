# Resonance plaza static-frame batching

Town review after the cross-light pass identified independently drawn stonework
and metal trim in the fourfold portal. The frame now batches by material and
shadow policy, preserving every triangle, UV and transformed normal. Paving
keeps its separate shadow policy; all four shards, restoration rays and the
animated veil remain independent. Collision footprints, Entity setup, portal
eligibility, repair state, reduced-motion behavior and interaction stay unchanged.
The model owns its merged geometries and immediately releases replaced sources.
An unbatched construction option exists solely for visual comparison.

Three new surface/state/ownership tests passed1.007s; six existing portal and
courtyard checks passed in the preceding targeted run. An initial fixture
omitted the production state's legacy:false field; corrected the fixture,
not the progression rules. Scoped lint and whitespace passed.

High/Low browser comparisons use the real renderer and Entity mesh setup in
unrepaired, partially restored and restored states. They save24/12 draw calls
respectively, retain identical triangle counts in the fully visible comparison,
and produce mean pixel error below.00014 on a0–255 scale. Changed-pixel fraction
at an8-byte threshold is0 High and.0000032 Low. High capture inspected.
The final two comparisons plus populated Earth/town High passed33.0s.
Evidence:/tmp/eidolon-portal-batches-final-0929.

Town counters vs /tmp/eidolon-town-draws-0929: common well423→400 draws,
menders' yard369→357, service court442→432, trading roof461→449. Coarser frame
culling adds32 triangles at the well and2840 at the service court; elsewhere
some counters are unchanged. No FPS claim or final budget acceptance: town
still exceeds the350-draw High target. This is not a geometry simplification.

Optional draw diagnosis now occurs during the initial scene visits, before
later prepared impact/attack actors are added. Remaining offscreen Skeleton
shadow submissions are the three explicitly included starter monsters, not
duplicates; those remain in the fixture. Do not remove genuine scene contents
to make counters pass. The first diagnosis suggested the later fixture actor
explained the cost, but the earlier capture disproved that for the town view.

No new CI job, campaign soak, release/version bump, deployment or prior gate
waiver. Procedural art, town/woodland performance and full-route acceptance
remain unfinished independently of this local optimization.
