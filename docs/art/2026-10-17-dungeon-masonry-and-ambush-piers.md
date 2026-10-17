# Room masonry and ruined ambush piers — qualified component

Selected source: `1a60a175708d228ba7851ea9cfabb852e9b1beea`, containing the
[distinct room-purpose floors](2026-10-17-dungeon-room-floor-candidate.md) at
`cf95328ebf9c3328846fd889be5ae07863735890`. This isolated component is selected
for later assembly, not part of current recovery release1.79.78. Publication
must follow that release's exact CI/deployment/live acceptance.

Treasure vaults, shrine chapels, broken ambush galleries, sentry courts and
parallel passages replace five uses of the same court plan. Existing entry,
approach and arena attribute bytes remain exact. Ambush rooms also replace six
plain four-sided spikes with shared tapered, bevelled stone courses and broken
crowns. Physical stone maps replace the alternating plain dark/metal finish.
Positions, lean, former transformed bounds, shadows, central encounter space,
collision, interaction and gameplay rules remain. The geometry uses existing
kit materials/batching and introduces no module, texture or material resource.

The shared pier has112triangles against8for the old spike:624extra baked
triangles per ambush room. Its actual position/normal/UV/index arrays use10,752
bytes against656, adding10,096cached CPU bytes per kit. This is additional to
the floor component's232,320CPU bytes when all eight plans are cached. No
zero-cost claim is made. In ten native ambush views, High adds1,248submitted
triangles including shadows and removes two submissions; Low adds624triangles
and removes one. Every original scene cap remains unchanged.

Final source passes55checks/two suites:14vigil-geometry/placement cases and
41procedural-interior cases. The unchanged24floor cases retain their earlier
exact-source evidence, giving79distinct checks/three suites for the component.
Six pier checks are new, alongside13floor checks; eventual client total after
current78selection is804suites/12,521tests. Engine modules remain513, with no
new permanent browser case. Changed-file and private-fixture lint pass.

Two private native AMD/RADV cases pass in63.2seconds, retry0. All eight room
identities in all five dungeon themes run in High1280x900 and Low390x844 with
the supplied14-slot Fighter, real HUD and twelve actual animation/render frames
per room. All80source restorations are exact;70unchanged room views retain
exact RGBA hashes/draws/triangles and10ambush views change as intended. All ten
theme/quality cleanups return to their exact geometry/texture baselines.
Foreground and buried-marker controls retain their original thresholds; remote
canonical origins and explicit base-floor visibility controls remain.
Original Low200draw/85,000triangle and High350draw/250,000triangle caps pass;
observed moving peaks are42draws/23,255triangles Low and74/55,005High.

Both existing copied published-floor cases additionally pass in26.1seconds,
retry0. Actual generated dungeons retain the original texture/program/material,
collider, floor semantics, rendering and cleanup checks in all five themes and
both qualities. The separate earlier floor component retains its own2native
and2copied-build cases; these are scoped comparisons, not a whole live campaign.

Manual review inspected source/candidate ambush pairs in all five themes and
both qualities. Stone courses read clearly beside the equipped actor; service
markers and HUD remain readable. These still-sparse controlled rooms are not
final modern-art approval, a busy-combat frame-time pass or physical-phone proof.

Original failures remain frozen. The first footprint candidate failed five
theme cases; four-file inventory SHA-256
`2a9ec947898da5e59161df4b2f81f51e0876b747d0d43bb777af60b593cde916`.
A narrower correction still exceeded the old leaned bounds by about.057metres;
four-file inventory `d65a5f83db49a0fb279566b7909285f69b64711db8616511ce100be1a5d5a98e`.
Explicit per-vertex tapering fixes those bounds without relaxing their assertion.
An intermediate BufferAttribute setter typo caused six constructor failures;
two-file inventory `d8aa9479d9a284ee41df8fe080ce41e1601368ce320bc88c914eb3d8cd8b875e`.
Final source uses the actual setXYZ API. Earlier intermediate41-case interior
and geometry-subset observations are retained but final55-case evidence governs.

The initial182-file qualification packet estimated the extra CPU arrays
incorrectly at3,744bytes. Actual arrays measure10,096extra bytes; its inventory
`afca91d84cd6d3872ca176a09dc565f5245a6f1f849f0044ef975c64fbb9eb38`
is retained as superseded metadata. No runtime, assertion or test was changed
or rerun for that accounting correction.

Private evidence:
`/home/aeml/.local/share/eidolon-dungeon-room-floor-review-20261017/.qa-room-piers`.
The final183-file `qualified-corrected-evidence-inventory.json` SHA-256 is
`b9ac30b6a12fc15520fd0a9db3b7d7d33036ce2c1cf5faba3925dbd81c22400e`.
It verifies exact source/test inputs and the177-file parent floor selection,
retaining all earlier observer corrections and superseded local-origin views.

Combined-source qualification, synchronized release preparation, full CI and
exact deployment/public acceptance remain required. Room architecture/dressing,
broader world/combat/audio/actor-fit/performance/device/security/operations/owner/
F1-F5/beta/1.99requirements remain open. Human campaign/phone feedback and
soak/stress remain deferred, not passed. Public admission and earned progress
are unchanged.
