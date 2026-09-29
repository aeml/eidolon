# Town architecture and actor batching integration — September 29

Local combined reference candidate based on `3eacbdbc`; not deployed.
Runtime identity remains1.38.0. No new release or final visual acceptance.

Integrated layered slate roofs/dormers, recessed arched window/door surrounds,
and quieter courtyard paving. The production MeshFactory now requests rigid
batches for all four procedural player classes. Batching preserves animation
pivots, equipment anchors, body-mask boundaries, transparent ordering and shared
resources; authored/skinned models are not passed through it. Contact timing
and recoil from the previous integration remain intact.

68 focused tests passed6.71s across eight suites: roofs/facades, town structures/
courtyards, humanoid equipment/stealth/pooling batches, rigs, basic-contact timing
and hit reaction. Scoped lint/whitespace pass. The generated admin-landing file
still matches without regeneration: this transfer changes no walk colliders.

Five browser checks passed30.9s: town structure gallery, both four-class rigid
batch comparisons and desktop/phone populated world with prepared combat.
Artifacts: /tmp/eidolon-town-actors-integrated-0929.
At Idle/Run/Attack/Death the four-class scene uses126fewer High draws and63fewer
Low draws with identical triangle counts. Maximum mean pixel error was .000247
High/.000147Low; changed fraction above an8-value channel difference was at
most .00000539High/zeroLow. Thresholds unchanged. These are draw/equivalence
measurements, not a new FPS or crowded-party performance claim.

Inspected High trading-house roof and phone Low common-well images. Roof and
facade construction now has more depth; courtyard paving competes less with
the well. The scene still has visibly procedural proportions/materials and
broad flat paving. Final modern-ARPG art/performance acceptance remains open.

Next: integrate quieter decorative status/impact effects while preserving exact
danger/healing boundaries; then remaining elevation/rock and audio dependencies
and the full reference review. Pending1.39/1.40 owner release decision remains
unassumed. No campaign soak, version bump, production write or deployment.
