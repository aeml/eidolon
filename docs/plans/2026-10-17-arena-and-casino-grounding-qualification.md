# Arena and casino grounding qualification — October 17

Selected candidate runtime: `41f1c6679302ac60ad95441106731ef4e2e90c57`, based on deployed Alpha1.79.69.

The old arena floor sat at Y0.1 while server players stand at Y0 and ordinary
party/hostile rings sit at Y+.05/.06. Its floor hid the markers. Decorative arena
circles at Y.115 and casino medallions/gilt borders also covered ordinary markers.
Three first-failure logs retain the arena-floor, casino-finish and crossing-circle
reproductions. Existing depth testing stays enabled.

The arena floor now matches server Y0. Decorative circles sit at Y.015. A shallow
foundation supports the court and beacons; underlying overworld ground hides only
inside casino/arena and restores on exit. The existing paving map, four boundaries,
beacons and canonical50.5×34.5 walk footprint remain. Dressed stone caps fit the
original boundary boxes; fortress/fieldstone detail uses existing materials.
Casino layered floor finishes top out at Y.032 on both floors. No player offsets,
movement limits, colliders, rewards, table anchors, admission, prices or wagering
rules change. Root arena meshes increase17→18 for the foundation.

Verification:

- 83 focused checks/six suites and full lint pass. Scene visibility restores on
  exit and stays correct across quality switches; original boundary bounds hold.
- Final native High/Low arena cases pass with supplied four-class fourteen-slot
  outfits, five prepared pose/boundary views per quality, standard100/100/100 camera
  and zoom18. Ninety normal RAF Run frames per quality plus screencasts show motion;
  owned geometry/material/texture disposal and canvas retirement pass.
- Immutable prior court AND scene-owner sources reproduce the old negative marker
  gap and visible world ground. Prior/current screenshots were visually reviewed.
  Initial current images precede the additional crossing-circle correction; final
  native images qualify that correction. No timing retry or performance claim.
- Native High/Low casino component cases compare marker-off/on framebuffer pixels
  for party AND hostile rings on public/VIP medallions: old source yields0 changed
  pixels in all8 views, corrected source yields418–3376. Both versions submit one
  additional draw/64 triangles with depthTest=true. Corrected images were reviewed.
- Four actual authenticated practice-duel cases pass, one per class, two prepared
  fresh level1 clients at a time. Ordinary UI admits server combat, observes attack
  cadence/damage, ends practice without ranked rewards and restores town resources.
  Eight entry/combat HUD captures confirm server Y0, delivered actor meshes, owned
  foundation/boundaries and hidden underlying world ground. Actual starter gear is
  distinct from the controlled fourteen-slot scene. Art snapshots are read-only.

Native renderer: AMD Radeon/RADV RENOIR through system Chrome153. The Low390px view
is a desktop browser viewport, not physical-phone qualification. Casino component
views omit character/furniture/wagering; accepted69 evidence owns those unchanged
flows. No Well Rested-specific fix, campaign-earned progression, network capacity,
soak/stress, whole-game FPS or final art/beta acceptance is claimed.

Private evidence: `/home/aeml/.local/share/eidolon-arena-art-review-20261017/.qa-arena-art`. Frozen 297-file inventory SHA-256
`6c76b20ce15caa0345ffae0ed0a867bd5d297c63f571deffda76020edeef851f`. All retained failures remain included. Frozen processors must not be
rerun; execution stdout and mutable continuation are excluded. Broader original
art/game/performance/readiness/owner/F1–F5/beta/1.99/handoff remain open. Human
pacing/physical-phone feedback and soak/stress remain deferred.
