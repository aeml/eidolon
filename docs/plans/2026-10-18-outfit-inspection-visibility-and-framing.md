# Unobstructed outfit inspection and closer framing

This isolated component is based on corrected82
`48cf3c079c3e118c6aceaf6e9507ce6bd5f9a293`. It is locally implemented with CPU
evidence; native review, integration and publication are still required. It is
not part of the pending82release and does not declare final garment/art acceptance.

Review of the retained82native Winterthorn Revel Low, Gilded Harvest Low and
Solstice Pyre High captures shows held shields obscuring the armor front and
room for closer inspection framing. The source captures remain unchanged in
the qualified82preview evidence. This is a fitting-room usability finding,
not evidence that all collection poses/devices meet final visual quality.

Veyra's outfit selection now offers a keyboard-accessible pressed-state control,
Hide held gear in preview. It retains that inspection choice while comparing
equipped and selected armor, resets when browsing a held look or reopening,
and observes the existing current-owner/action guards. It sends no equipment
or appearance command. Held-slot visibility is borrowed only for the private
preview draw and restored in finally, including already-hidden parts and failed
renders. The actual loadout, animation grip and selected garment stay intact.
Ordinary character portraits retain their existing framing and controls.

Pose inspectors now frame visible geometry rather than invisible undergarments
or temporarily hidden held parts. The bounds sample actual skinned/morphed
vertices and transformed instances. The full visible figure receives a closer
orthographic fit with margin; held-item focus keeps its existing item-front
direction. No texture, model, material, animation mixer, permanent render loop,
garment price, stat, saved equipment or class rule changes.

Six selected new feature cases fail on unchanged source; one other selected case
passes and32are unselected, in2.590seconds. The first broader positive attempt
passes37cases but two catalogue checks cannot read server content omitted from
the sparse checkout. That setup failure is retained. Materializing only the
required tracked content and adding a real skin/instance-bound case yields
40passes/two complete suites in4.106seconds. Coverage includes both held slots,
private/live visibility separation, render-error restoration, readable unclipped
body framing, ordinary portrait behavior, real deformation/instance bounds,
armor/weapon comparison, reopening and replaced-owner controls. Changed-file
lint and whitespace checks pass.

The existing24outfit native cases are retained with all original pose, compare,
apply, asset, layout and ownership checks. Prepared additions exercise pointer
and Space-key toggling, observe visibility during the actual renderer call,
verify restoration and retain an unobstructed preview capture. The observer is
bounded, pass-through and idempotently restored even after a failed test. All
24cases are enumerated; that changed native source is **unexecuted**. Review
those cases plus the existing12held previews before selecting this render change.
No local native run starts while CI is live.

Private evidence is under
`/home/aeml/.local/share/eidolon-outfit-inspection-20261018/.qa-outfit-inspection`.
The original full game/world/art/combat/audio/performance/mobile/security/
operations/owner/F1–F5/beta/1.99scope remains active. Physical-device, campaign,
listening and final collection reviews remain open; soak/stress remains deferred.
