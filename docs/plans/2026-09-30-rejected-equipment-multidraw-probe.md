# Rejected animated equipment multi-draw probe

Experimental branch only. **Do not merge or publish this renderer change.**
Appearance/submission savings are insufficient: busy-scene frame time gets
substantially worse on the named device. Retain this implementation and evidence
to avoid repeating the same experiment, not as completed1.48 performance work.

The probe groups exact material/render/attribute state across equipment anchors
using per-actor BatchedMesh buffers. Source geometry/maps, fit and animated
matrices remain; transparent/stealth pieces, changed state and unsupported
multi-draw use ordinary meshes. Owned buffers are idempotently retired without
disposing shared surfaces. Hidden actors skip updates. This is not a supported
production policy despite passing functional checks.

Five equipment/stealth/replication/graphics suites312checks pass7.368s.
After adding unchanged-transform caching, the14 helper cases pass1.334s.
Two Chrome High/Low comparisons15.0s cover21 four-class pose pairs each,
including stealth, with original pixel thresholds/triangle assertions retained.
High maximum mean difference0.001736508, changed fraction0.000014286;
Low0.000488889/0.000007937. High opaque calls468→108Fighter,478→94Rogue,
442→102Wizard,478→126Cleric; Low227→47,232→40,214→44,232→56.
Stealth remains exactly equal pixels/calls/triangles. Evidence:
/tmp/eidolon-1-48-animated-equipment-0930.

The actual ten-hero/Malachar/four-field/four-warning workload retains all
triangles and passes unchanged resource-repeat assertions, but regresses badly.
Native High1572calls/166327triangles (previous safe2592), Low847/85546
(previous1357). High busy57.4median/114.1p95ms, repeat58.3/97.7;
Low39.8/73.6, repeat37.7/67.7. Both miss their original20/33.4and33.4/50
targets. High geometries475/textures520, Low474/506, repeat-stable but much
larger than the safe301/54and300/40 baseline. Evidence:
/tmp/eidolon-1-48-animated-gear-busy-0930, bounded1.2min.

One High-only follow-up46.7s caches exactly unchanged matrices and attributes
the update CPU work, without altering180sample windows/resource assertions.
Busy53.5/99.9, repeat58.7/101.4ms remain unacceptable. Update CPU median
3.3/3.2ms, p9510.2/8.7;743 matrix writes/frame; total render CPU median51.0/
56.3ms. Resource/call/triangle values unchanged. This does not prove a specific
driver, upload or shader cause, but rejects draw-count-only acceptance and
shows caching alone does not rescue the approach. Evidence:
/tmp/eidolon-1-48-animated-gear-upload-cost-0930.

Next investigation should avoid hundreds of per-material actor matrix/
indirection textures (for example, shared per-actor skeletal transforms), with
the same independent pose/stealth/edge/shadow/fallback/lifetime requirements.
No further unchanged busy replay, target relaxation or scene detail reduction
is justified. Production candidate returns to safe d1da7467, retaining the
previous compatible-color, shadow and actual initial-view fixes.1.48 remains
incomplete; this probe earns neither a release nor a gameplay improvement claim.
