# Dungeon wall mineral finish and shaped piers

Qualified source: `2f9e3f783414017e7ef84eebee5fecd85f221796`, based on corrected
dungeon79 `a1feaefbb20f044f7d89258a4b1e1be614df12a4`. Selected for the next
assembly; not deployed or final modern-art approval.

Small physical chamfers shape the existing opaque wall-pier shafts in all five
dungeon families. The shared helper remains in the existing vigil module, and
each wall remains one cached geometry/material submission. Original collider
envelopes, narrow-wall boxes, foreground cutaways, architecture layout and UV
projection remain. No shape projects into the walkable room.

The first geometry-only review passed its technical checks but showed that the
four elemental wall palettes still hid their own architecture. Mineral wall
albedo now stays distinct from colored regional lighting, following the existing
floor treatment. Molten stone retains warm mineral color; Tempest, Abyssal and
Umbral retain their cold/tidal/violet families. Verdant wall material remains.
Floors, global lighting/fog, wall relief, roughness and emission are unchanged.
No light, texture, material object, shader branch or module is added.

34distinct focused cases/three suites qualify the final selection:24unchanged
geometry cases remain valid for the exact same three geometry files, and ten
material cases pass in12.493seconds. A separate16,384-sample current/source check
retains exact floor outputs and wall relief/roughness/emission. Existing periodic
surface, bounds, normal, UV, cutaway and wall-triangle criteria remain intact.

Four final native cases pass, retry-free, in31.822seconds. Actual generated
rooms cover all five families in High1280×900 and Low390×844 with the supplied
fourteen-slot Fighter and HUD. Each wall view advances twelve actual movement
frames and verifies changed bone pose. Same-pose controls swap the original
wall geometry and original wall materials together. All ten source restorations
are exact; all ten GPU resource returns are exact; actual normal/roughness/
emissive texture bytes match their source. Draw submissions stay exact. Original
High350draw/250,000triangle and Low200draw/85,000triangle scene limits remain.
Observed peaks are64draws/58,139triangles High and25/20,705Low. The existing
elemental wall cap remains3,000triangles, reached by the largest HighAbyssal wall;
the separate original Crypt vertex cap remains unchanged.

Manual review covers all ten source/candidate wall pairs and representative
desktop/portrait HUD captures. The revised elemental stonework and shaped edges
are more legible without brightening the global scene or obscuring the actor.
These are native desktop/browser-viewport observations, not physical-phone,
whole-world frame-time, campaign or final all-family art acceptance.

There is a bounded geometry cost: a maximum-bay122mVerdant wall adds208triangles
and19,968cached CPU attribute bytes; elemental walls add144triangles and13,824bytes
per cached size. Existing cache sharing remains. No additional submission is
required. The earlier geometry-only four-case143.685second review, including
inherited observers outside the final material scope, is preserved as an
unselected271-file parent. Those unchanged extra observers were not repeated in
the focused final run.

Private evidence:
`/home/aeml/.local/share/eidolon-dungeon-room-floor-review-20261017/.qa-wall-pier-finish`.
The frozen73-file `qualified-evidence-inventory.json` SHA-256 is
`1f09922ed02c1d0a2edd4b6ac4dbebf16fd6cce9550b63482ac9ffa79aa11a36`.
It retains final source, reference controls, actual reports, sampled-channel
proof, ten image pairs, HUD views and the271-file geometry-only parent.

Broader room architecture/dressing, floor repetition, moving world/combat,
supported devices and final owner review remain open. Full original game/world/
art/combat/audio/performance/device/security/operations/owner/F1-F5/beta/1.99scope
remains active. Campaign/phone feedback and soak/stress are deferred, not passed.
