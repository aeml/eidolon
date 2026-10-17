# Close-camera rendering finding — October 17

Status: **open performance finding**, software-rendered prepared scene only.
This record selects no experimental rendering or material code.

A private leaf-surface comparison on source
`4599a8a25d3cce4ae6d49eb59b73ed08f7e136ac` exercises the current flat-profile
Earth world with four supplied, fourteen-slot Fighter/Rogue/Cleric/Wizard
actors, actual HUD and supported camera zooms15and5. Actor assets, rigs,
equipment, visibility and actor geometry policy are unchanged. The experimental
leaf factory retains exact original position/normal/color bytes and triangle
counts; only UVs and the compared leaf surface shader differ. The reference uses
the exact original wind material. Both variants have identical submissions.

At zoom5the scene submits410,270triangles High against the original250,000limit,
and124,224Low against85,000. Old/candidate/restored counts match exactly in the
same observation. Both diagnostic cases therefore fail; no view or actor was
removed and no budget was relaxed. All four actors remain in the scene; the
actual frustum/nearby trees determine visibility, so the390pxcase does not prove
that all four are wholly on screen. Ordinary zoom15gate/road/grove and24realRAF
motion frames per quality remain under their original draw/triangle limits.

This is not a measured shader triangle regression, native/frame-time result,
networked encounter or physical-device acceptance. The unchanged actor geometry
owner uses42/47pixel thresholds and can return original geometry at close zoom.
That path merits direct owner/index/pose observation; these results alone do
not prove how many triangles it contributes or authorize changing its thresholds.
Do not lower detail, hide supplied models or infer that prepared indices are
visually interchangeable at close range without actual source/pixel evidence.

Retained packet:
`/home/aeml/.local/share/eidolon-understory-leaf-surface-20261017/.qa-understory-surface/software-evidence-inventory.json`,
44files, SHA256
`a176245c5054bc1a9900b13b14f4f892289f98c56e6ac8cebecb0ea8fdd73380`.
Both failed software cases, all paired images/rows,48motion frames, resource
retirement and original-factory/geometry/shader audits are preserved. The leaf
surface runtime remains isolated and unselected. The remaining-work register
retains this finding alongside the existing cold/global/connected/device
counterexamples. It closes no1.87, feature-freeze, beta or release gate.
