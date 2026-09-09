# Alpha 1.0.58 predeploy phone-route repair

CI34355888468 failed before deployment. Original evidence is retained at
`/tmp/eidolon-rest58-mobile-failure-Hpj06F`: first attempt had no usable gear
after eight kills; retry passed both phone bag orientations but stash stayed
hidden. Production remained Alpha 1.0.57. This is not a healing/buff failure.

Diagnostic-only fee85d2 passed the full bag/storage route in32.0s (35143),
archive `/tmp/eidolon-rest58-phone-diag-proof-j7gjUx`, credential scan0. This
passing replay did not explain the earlier stash failure.

Fresh-entry/orientation regression51e3f30 then FAILED on entry5/8 (97427).
Log `/tmp/eidolon-rest58-stash-diagnostic.log`, archive
`/tmp/eidolon-rest58-stash-entry-failure-XKKRDY`, scan0, exact owned cleanup.
The prior landscape projection was remapped into portrait before the camera
resize settled: tap261.41,209.11; normal portrait stash point381.72,289.63.
Actual pointer stack/hover/pending were empty; player remained at spawn.
Viewed screenshot shows the chest at the right edge, away from the tapped point.
No pathing or storage request occurred. No production interaction change needed.

The helper now waits for rendered, stable visible projections before tapping.
It never forces the camera, raycast, target, player position or storage window.
Original30s open assertion and complete serialized item persistence checks stay.
Eight fresh orientation/entry journeys are included in the normal full gate.

The separate loot setup assumed eight kills guarantee gear. Source actually
rolls0.5 mixed pool ×0.6 equipment retention ×36/38 equipment candidates,
approximately28.4% per ordinary kill. No-gear probability after eight is~6.9%.
Setup now allows at most32 ordinary encounters, stops immediately on earned
usable gear, retains420s outer deadline and every normal kill/ownership check.
No item grants, loot boosts or guaranteed-loot commands. Read-only loot/target
receipts and entered-world-only failure screenshots improve future diagnosis.

Corrected focused browser and full client/lint validation are pending. Original
failures remain failed. No production acceptance or full-roadmap completion.
