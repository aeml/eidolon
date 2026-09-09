# Well Rested aura batching — separate visual/performance prototype

This is unpublished follow-up work, based on recovery58/ee8a713. It is not the
canonical recovery release and must not replace or delay its running acceptance.
The inherited1.0.58 metadata is not authorization to publish this as1.0.58.
Keep final recovery ancestry and choose the appropriate later version with its
own patch notes only after the visual/performance gates below are met.

The original aura uses19 visible meshes on High and10 on Low. Its16/8 crystal
sparks share shape and two opacity settings. The prototype groups sparks into
two InstancedMeshes (gold and four vertex-colored elemental echoes), retaining
all16/8 sparks and the same three/two visible ground rings. Visible mesh count
is now5/4. Mesh count is not measured WebGL draw calls, frame rate or proof that
the aura caused earlier low-FPS captures during concurrent work.

Every authored phase, radius, rise, fade, scale, rotation, color and opacity is
retained. Materials remain transparent/additive with no depth writes or shadow
casting. A fixed conservative sphere encloses the complete rising/orbiting cycle
so batching does not disable frustum culling or clip later motion. Instance
matrices are actor-owned and dynamic; cached geometry/materials remain shared.
Disposal releases only per-instance GPU buffers, once, without destroying cache
resources still used by other actors. No reward, stat, clock or authority code
changes.

Node24.18.0 regression evidence:

- Old unbatched implementation:3 new budget/lifecycle tests failed;2 original
  motion/color parity tests passed. Log `/tmp/eidolon-rest-aura-batching-before.log`.
- Prototype:33 tests across batching, all attached statuses and Well Rested
  presentation passed in2.214s, plus lint/diff. Pose/color comparisons cover both
  quality levels at six elapsed times, including a long-running phase; all
  transformed vertices stay inside the batch bound. Actor buffers remain
  independent and disposal leaves cached shape/materials untouched.
- Logs `/tmp/eidolon-rest-aura-batching-{after,lint}.log`.
- Full client regression on e21a098:249 suites/3,497 tests passed in146.96s,
  followed by lint, under Node24.18.0. Runtime assets were prepared with the
  existing prepare-client script. Logs
  `/tmp/eidolon-rest-aura-batching-{prepare,full-client,full-lint}.log`.

Required before promotion:

- Retain the completed client regression above and rerun after any further code change.
- Controlled rendered comparison of original/instanced aura at identical phases,
  including actual characters, populated party scenes and both quality settings.
- Measure actual renderer draw calls and steady-state frame times on documented
  hardware; do not substitute this mesh-count reduction for an FPS result.
- Verify stealth, death, scene changes, repeated quality switches and reconnect
  with rendered evidence. Retain the native rest/expiry/party gameplay gates.
- Add verified checks to the later release's required pipeline, preserve the
  completed recovery release ancestry, and publish separate versioned notes.

No second local browser is started while the canonical recovery gameplay run
owns the browser slot. Physical-phone performance remains an open roadmap gate.
