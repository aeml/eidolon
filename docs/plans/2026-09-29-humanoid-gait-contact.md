# Player gait contact without changing movement rules

Locomotion review found effective-speed scaling already implemented. The actual
procedural walk poses still kept both feet above the ground throughout their
cycle. Sampling60 phases measured lowest default soles at5.1–15.0cm Fighter,
7.5–17.3cm Rogue,5.2–10.5cm Wizard and6.6–12.5cm Cleric. Runs likewise never
reached the ground; some Rogue phases floated36cm above it.

The four procedural factories now bake the Walk/Run pelvis-height track against
their default footwear. Walking retains a support sole at approximately0.8cm;
running retains alternating stance windows and a short flight up to10.8cm.
The lower-body angles, ankle articulation, clip durations, movement speed,
world position, rotation, attack/ability clips, jump behavior and collision are
unchanged. This is vertical grounding, not complete horizontal foot-locking or
final authored locomotion quality.

Sampling happens only on the first construction of each procedural class and
is cached as small immutable height profiles. Each actor receives independent
track arrays. The temporary mixer restores the bind pose and is uncached; no
per-frame vertex scan, foot solver, terrain raycast, new geometry or material.
The helper is called by the four code-owned factories, not imported actor art.

## Verification

56 focused grounding, moving-cast and animation-state checks passed3.76s.
The grounding selection covers all four classes, default footwear, Iron Boots,
Leather Boots and Sandals at96 phases of both Walk/Run on batched models.
Support soles remain between-1.2cm and2.5cm during walks/run stance; run flight
remains under12cm. Tiny fitted-sandal differences are retained rather than
raising every character. Includes exact loop closure, fixed root transform,
bind-pose/cache reuse and independent clip buffers. Scoped lint/diff passed.
The existing humanoid/ability-clip suites also passed27 checks in2.217s.

Existing desktop1280 and phone-width390 moving-cast browser cases passed15.2s.
The fixture now actually equips class-appropriate footwear, retains its cast/
support-gesture assertions and checks ordinary Walk/Run stance through Actor's
real mixer. Desktop walk and Low phone-width run captures inspected at
`/tmp/eidolon-gait-contact-0929`. These are prepared runtime actor poses, not
authenticated travel, physical-phone acceptance or human combat-feel approval.

No campaign soak, runtime bump, deployment, earlier release-gate waiver or
overall character-art sign-off. The procedural actors remain intermediate;
the owner-supplied actor pilot is still deferred.
