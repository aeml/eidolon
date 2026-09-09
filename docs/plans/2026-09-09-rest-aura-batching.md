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

## GPU comparison — completed September 9, 14:57 UTC

Run7912 on59be536 PASSED1/4.9s under Node24/system Chrome with
ANGLE AMD Vulkan1.4.318 / RADV RENOIR. Log
`/tmp/eidolon-rest-aura-gpu-comparison.log`; full report/images archive
`/tmp/eidolon-rest-aura-gpu-proof-EVNdVm`, scanner0, browser port41960 closed.
Viewed both quality screenshots: ground rings and rising motes remain visible,
with no enclosing cube. The fixture is a prepared Wizard, not an earned buff.

At elapsed0.37/1.8/4.2s the High incremental draw calls were9/10/10 versus
37/38/38 in the expanded reference; Low was8 versus20 at every phase. RGB
difference was exactly0 in all six256px render-target comparisons, with nonzero
reference signal14277–20988. This proves the controlled aura contribution uses
fewer draws on this renderer without changing these captured pixels; it is not
an FPS measurement, group-scene proof or physical-phone result.

Populated groups, steady frame times, actual stealth/death/scene/quality/reconnect
transitions and inherited native gameplay gates remain required before promotion.
No integration into primary or58, no release pipeline changes, no publication.

## Comparison method and earlier preparation

`tests/e2e/well-rested-batching.spec.js` renders a real Wizard and ground plane
with no aura, an expanded-mesh reference, and the instanced aura at identical
phases. It checks both qualities at three times, measuring incremental WebGL
draw calls and RGB differences against the aura's own visible contribution.
An empty aura cannot pass by hiding its difference in a mostly unchanged scene.
The expanded reference uses the same instance transforms; the separate authored
formula unit tests remain necessary to establish original-motion parity.

Pixel arrays remain in the browser; only metrics cross the automation boundary.
The pure comparison is injected as source rather than downloaded from `/tests`.
Node24.18.0 focused tests passed12/2suites/1.791s, lint passed, and Playwright
discovered the one comparison test. Logs:
`/tmp/eidolon-rest-aura-pixel-final-{tests,lint,discovery}.log`.
The process handle77576 is now absent; these terminal log summaries, not the
missing handle itself, establish those earlier checks. GPU results are above.
This prepared fixture does not establish earned gameplay, party transitions,
frame-time improvements or phone performance, and is not a release gate yet.
