# Stranded Flotilla — local art refinement

Replaced round wreck ribs with squared ship frames, added salt-bleached timber
and darker tide staining, and broke the uniform plank ends. The two hulls now
have different damage and abandoned rigging. Folded, patched, torn sailcloth
replaces the flat rectangular sail. Both existing hull solids and the walking
lane remain unchanged; no encounter, reward or interaction changes.

Focused geometry and population checks passed (10 before the three additional
geometry cases; all six final geometry cases passed in 0.796s). Scoped ESLint
and whitespace checks passed. Existing populated Water/Fire browser coverage
passed both desktop High and phone-sized Low cases in 31.9s. Inspected both
Stranded Flotilla captures at normal gameplay framing:
`/tmp/eidolon-flotilla-0929`.

The wrecks now have clearer material and damage differences, but the broad
ground remains uniform and the actors still look procedural. This is an
intermediate prop improvement, not modern-ARPG art acceptance or a completed
connected play route. Added geometry/material variants have not established
an FPS improvement. No campaign soak, runtime bump or deployment.
