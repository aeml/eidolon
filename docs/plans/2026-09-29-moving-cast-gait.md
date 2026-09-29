# Moving-cast gait — September 29

Local continuation of6d8660bd. No release identity change or deployment.

Reproduced a motion defect with all four real procedural class rigs: during
an uninterrupted moving ability cast the actor continued translating, but the
right thigh stopped changing after Run faded out. All four new regression
cases failed before the fix with measured stride range0.

Added a narrow lower-body presentation mask for procedural actors. Before
each mixer update it restores the previous unmodified mixer pose; afterward,
while an ability and MOVING state coexist, it samples the existing Run/Walk
thigh, shin, equipped-foot anchor and pelvis-height tracks. Arms, torso,
weapons and authored cast clock remain the cast's original animation.
No gameplay position/rotation, cooldown, damage, resource or targeting change.

The layer starts from the fading locomotion phase, blends in over60ms and
retains phase on returning to normal locomotion. Effective movement speed
controls stride playback. Stationary, root/stun/freeze, jump, death, charge
and Whirlwind paths do not apply this mask. Local and remote actors share
the same update wrapper. Imported rigs without the procedural class marker
retain their existing path.

Track interpolants and bindings are cached per actor/locomotion clip, and
saved binding objects reused without per-frame entry allocation. No new
geometry, material, texture or draw. Mesh replacement/disposal restores the
base pose and releases the cache. No FPS claim.

Verification:
- Initial four stride regressions failed on the old code (0.869s).
- Final63 checks across moving-cast gait, animation state, hit reaction and
  basic cadence pass2.262s. Covers four classes, exact unmodified upper-body
  local transforms/cast time, stops, walk/slow playback, completion, remote
  authoritative position, mesh replacement and disposal.
- Scoped lint/whitespace checks pass.
- Prepared real-renderer desktop1280×900/High and phone390×844/Low frame-stepped
  four-class views pass9.5s. Three sampled cast phases each retain thigh and
  ankle movement. Artifacts: /tmp/eidolon-moving-cast-0929.
- Inspected desktop phases0/1 and phone phase1. Models remain procedural;
  this evidence proves the targeted animation correction, not overall
  combat feel, connected multiplayer, real-device performance or final art.

Root integration used only the reviewed Actor hunks/new files, preserving
unrelated root work (baseline differences were line endings/trailing spaces).
Next: broader combat presentation and world composition, with the full
roadmap active. High performance and pending1.39/1.40 release decision remain
open; no campaign soak or live mutation.
