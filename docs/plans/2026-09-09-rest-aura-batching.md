# Well Rested aura batching — separate visual/performance prototype

## Integrated regression — September10, 06:27UTC

Primary's fresh Wizard story-readiness run13998 is terminal and its exact
disposable services/ports are cleaned up; it no longer owns the browser slot.
On clean a877d46, full4349 passed256client suites/3627tests141.417s plus lint,
Node24.18.0. Full95316 `go test -race ./...` passed underGo1.24.5: root21.857s,
database1.260s, game348.191s and all other packages. Server source diff against
accepted59e236b37 is empty. Logs
`/tmp/eidolon-aura-integrated-full-{client,lint,server}.log`.

This closes the pending integrated regression run, not native/rendered or
promotion acceptance. Next are the unchanged ordinary rest journey, natural
expiry/reentry and two-real-player High/Low/repeat-High/reconnect checks with
native frame profiles, followed by the controlled GPU comparison rerun.
Actual rendered transitions and physical-device/baseline performance gates
remain required. No new version, gameplay/stat change, push or deployment;
release60 remains separate and queued on its unchanged candidate.

September10 status: still unpublished and separate from primary and the active
release60 pipeline. Accepted59 has now been merged as the baseline; inherited59
metadata is not a new release candidate. Native party verification has been
strengthened below but must wait for the owned Earth replay before using the
local browser. Earlier58prototype history is retained for provenance.

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

## Native party evidence preparation — September10

The existing two-real-player phone journey now checks High → Low → High again,
then a fresh login while the second client remains present. Read-only scene
observations require exactly5/4visiblemeshes, two instanced batches, all16/8sparks,
one attached aura group per actual owner, valid transparent geometry and correct
world positioning on both players. Reconnect also verifies the earned local rest
bank is retained. It does not grant buffs or fake remote actors.

Reuse the existing real-game scene profiler after60warmupframes for180samples
per quality phase. It records frame median/p95/p99, CPU-loop time, draw calls,
triangles, allocations and entity count. Added renderer identity, viewport/DPR,
user agent and document visibility to its evidence. Profiles are attached to the
report alongside native world/status screenshots, including separate repeat-High
images so first-High evidence is not overwritten.

These measurements establish a documented native workload observation, not an
automatic FPS improvement or physical-phone claim. Compare against an equivalent
unbatched native baseline before making a speedup claim. Keep controlled GPU
pixel/draw-call parity and authored-motion tests as independent evidence.

Focused83040:18observation-validator tests passed0.416s; lint and discovery of
the one native party test passed. The validator rejects missing sparks, old
unbatched meshes, duplicate owners, detached effects and invalid resource values.
No runtime change. Full regression after these test changes and actual native
party/expiry/journey execution remain due. Actual stealth/death/scene transitions
and wider populated-scene performance are still open promotion requirements.

## Accepted59 baseline integration — September10

Merged accepted e236b37, including final58 recovery/connection/release fixes and
59's interface/casino-roadmap work. The only merge conflict combined the native
party test's new profiler/observation imports with accepted backend-origin browser
arguments; both are retained. The second real client now respects the existing
production verification origin configuration. Batching, every spark and all
native quality/reconnect assertions remain intact. No new version or push.

Focused78996 passed299tests/6suites2.45s plus lint, including authored batching
motion/lifecycle, attached statuses, observation validation, live recovery gate
wiring and version consistency. Full integrated client/server regression and
actual native/controlled rendering reruns are still due; do not substitute
older58prototype results for the merged baseline. Do not run a second owned
browser or heavy tests while the primary Earth journey is active.

## Actor transition buffer ownership — September10

Added an isolated regression using two real Fighter actor instances and actual
attached-effect synchronization. Across three repeated quality/scene cycles,
stealth, dead/alive, inactive/active and authoritative rest-expiry/reentry states,
each retired aura's two instance-buffer dispose events must fire exactly once.
The replacement retains all16/8 sparks, correct mesh position and exactly one
owner group; another actor in the old scene keeps its same aura, unchanged
instance transforms and shared geometry/material resources. Final actor cleanup
leaves both effect scenes empty. Lifecycle synchronization cannot spend the
replicated30-second bank.

Focused55010 passed35tests/3suites2.705s under Node24, plus lint. Logs
`/tmp/eidolon-aura-transition-lifecycle.log` and
`/tmp/eidolon-aura-transition-lifecycle-lint.log`. Only tests/documentation
changed; runtime batching remains the existing prototype. This adds ownership
and disposal-event evidence, not actual WebGL memory measurements, rendered
scene transitions, native gameplay, FPS improvement or phone acceptance. All
pending integrated/full/native/rendered promotion gates above remain required.
