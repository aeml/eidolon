# Well Rested aura batching — separate visual/performance prototype

## Required pipeline wiring and rehearsal — September10, 07:24UTC

Code commitc23ef2f adds a mandatory predeploy renderer step after the existing
animation gallery and before full disposable gameplay. `npm run test:e2e:rest-render`
runs single-character parity, GPU lifecycle and5/20actor comparisons (four tests)
with no retries. Its wrapper propagates browser failure, sanitizes on exit and
fails on sanitation failure. JSON measurements and screenshots live in ignored
`rest-render-results/`, a sibling of the routinely cleared `test-results/` root,
and the predeploy artifact upload explicitly includes them. Line+JSON reporting
does not replace the preceding gallery's HTML report.

The full disposable `run_well_rested` suffix now requires journey/expiry, then
two-player quality/reconnect, then the two earned-rest death/dungeon checks, with
distinct output subdirectories and fresh actor suffixes. Every stage propagates
failure and stops later stages. Prepared encounter/level setup remains confined
to the disposable server; the ordinary production recovery wrapper is unchanged.
This is wiring on the unpublished aura branch, not a mutation of queued60.

Focused35tests/3suites passed1.403s, lint/bash syntax passed, and js-yaml parsed
the resulting workflow/step order. Full29228 passed260suites3647tests127.063s plus
lint underNode24.18.0. Tests execute mocked shell failure/sanitation paths as well
as checking required workflow ordering, artifact paths and native suffix wiring.
Logs `/tmp/eidolon-aura-gates-{unit,lint,full-client,full-lint}.log`.

Rehearsal68099 TERMINAL PASS on clean/frozenc23ef2f, Node24/systemChrome/RADV
RENOIR: actual new renderer command4/1.3m, ordinary journey/expiry2/1.3m,
two-player party1/44.7s, and death/dungeon transitions2/3.0m. No retries/skips.
The rendered JSON contains all4passing results and embedded lifecycle/populated
measurement attachments. Its checksum stayed identical after the combined native
suffix. Actual credential sanitation0; exact runIDaura-gates-0910 containers/
image and18560/18561/41960 absent after cleanup. Log
`/tmp/eidolon-aura-gates-rehearsal.log`; archive
`/tmp/eidolon-aura-gates-proof-ZXIT6U` with render results and native HTML/images.
Current native images are under `test-results/well-rested-{journey,party,transitions}`;
loose older transition directories retained in the archive are NOT this run's proof.

After archiving native evidence,13513 ran an actual default-output browser check
(single-character parity1/4.6s) and compared hashes of EVERY render evidence file,
including screenshots and JSON, before/after default-root clearing: unchanged.
Anonymous scanner0, port41960 closed. Log
`/tmp/eidolon-aura-gates-output-retention.log`; its HTML/results are separately
archived as `default-output-report` / `default-output-test-results`. Viewed the
current nested transition respawn/town-return images and20actor High render image.

This rehearses the added rendering gate plus all five native aura tests, not the
entire long full-character predeploy suite or production acceptance. Remote CI,
versioned notes/identity and final live checks remain due after60 is accepted.
Physical-phone/full-scene and the broader class/realm/group/campaign/raid roadmap
gates remain open. No runtime/server change, new version, push or deployment.

## Authoritative death and dungeon transitions — September10, 07:05UTC

Added `well-rested-transitions-gameplay.spec.js` and the matching isolated route
`well-rested-transitions`, with exact allowlisted disposable character suffixes.
The shared read-only observer requires the actual owner group, ancestor visibility,
all16 sparks/two batches/five High-quality meshes, valid transparent materials,
matching actor position and invisible interaction hitbox. No rest clock, buff,
server outcome or character position is patched by the browser observer.

Run23771 TERMINAL PASS2/3.0m, retries0, frozen19284f0, runIDaura-transitions-0910,
Node24/systemChrome, local API18560/Mongo18561/web41960. Both characters first
earned at least60seconds of rest through ordinary town time. Death fixture used
the existing allowlisted encounter waypoint/one-health setup and protection-off
command, then required a real hostile damage receipt and authoritative DEAD.
Aura was visible at bank59.591 before death, absent with54.154seconds remaining,
still absent after dead login with53.034remaining, then present exactly once after
real Respawn with53.894remaining, full110HP/110MP, and again after fresh login.
Interaction-hitbox opacity stayed0. This distinguishes death suppression from
coincidental buff expiry; it does not claim unprepared combat pacing.

Separate level30 Wizard used allowlisted level readiness only, the ordinary town
guide, actual Verdant instance entry, credentialed login inside that same instance,
and Recall to town, twice. Both cycles retain one visible positioned aura with
16sparks and hitbox opacity0. Dungeon entry/relogin banks67.320→65.903 and
73.790→72.869; returned town banks67.124/74.091. Time spent opening the guide in
town naturally adds rest before entry. Scene rebuilding may reparent an existing
effect or dispose/recreate it; both must leave exactly one owner group, not an
orphaned duplicate. Neither cycle fights/clears the dungeon or proves other realms.

Log `/tmp/eidolon-aura-transitions-native.log`; complete HTML/images archive
`/tmp/eidolon-aura-transitions-proof-g0YrH7`. Actual-credential wrapper scanner0;
exact run containers/image and18560/18561/41960 absent after cleanup. Viewed
hostile-death/real-respawn and both dungeon entry/final town return screenshots.
Portal test camera framing is for transition inspection, not phone or full
dungeon visual acceptance. No second owned browser remains active.

Initial focused23379 failed on a parenthesis typo in the new observer unit test;
lint was not reached. The separate native route was already started and completed
on its frozen source; no test files were edited during that run. Corrected the
unit-only expression afterward. Focused28tests/3suites passed1.636s plus lint and
shell syntax. Original failure retained in `/tmp/eidolon-aura-transitions-unit.log`;
corrected logs `/tmp/eidolon-aura-transitions-{unit,lint}-fixed.log`.
Full54110 passed259client suites/3638tests129.459s plus lint underNode24.18.0;
logs `/tmp/eidolon-aura-transitions-full-{client,lint}.log`. Runtime/server code remains unchanged.
Keep the broader realm/class/group/physical-phone gates open; next prepare required
pipeline integration for a later version without bypassing queued60 acceptance.

## Populated rendering comparison — September10, 06:50UTC

New `well-rested-populated-render.spec.js` verifies5 and20 prepared mixed-class
actors (Fighter/Wizard/Rogue/Cleric), High/Low quality, three staggered authored
phases per quality, and a batched/reference/batched fixed-pose frame sequence.
The test-only expanded reference reuses source geometry and caches four tinted
materials across actors; it does not artificially allocate one material per mote.
Three new unit cases verify both qualities' visible part counts, source transforms,
colors/opacity, shared resources and standalone browser injection. Together with
authored-motion/pixel guards, focused17tests/3suites passed1.704s plus lint.
Logs `/tmp/eidolon-aura-populated-{unit,lint}.log`.

Rendered35411 TERMINAL PASS2/1.1m, retries0, system Chrome149/ANGLE AMD
Vulkan1.4.318/RADV RENOIR, viewport1280x720/DPR1. Five actors passed29.3s and
twenty passed37.1s. All12 comparisons had exactly0 RGB difference and nonzero
aura contribution67497–154745. Actual incremental aura draws:

| Population | High, batched / reference | Low, batched / reference |
|---|---|---|
| 5 | 49–50 / 189–190 | 40 / 100 |
| 20 | 199–200 / 759–760 | 160 / 400 |

Each fixed-pose mode used60warmup+180sample frames. For20actors, High full-scene
draws were1541/2101/1541 and Low1501/1741/1501 in batched/reference/batched order.
High render-submission CPU medians19.4/31.0/19.4ms, frame medians16.7/33.3/16.7ms
and p95 33.4/50.0/33.4ms. Low CPU medians14.4/18.1/13.2ms; all frame medians16.7ms
with p95 33.3/33.4/16.8ms. Geometry/texture counts remained201/6 across each
repeat. Five-actor geometry/texture counts remained186/6, frame medians16.7ms.

These are controlled fixed-pose renderer observations with default class models,
not animated combat, equipped raid groups, live native FPS improvement, network
concurrency, or physical-phone performance. The repeated sample exposes some
timing variation; no hardware-independent FPS threshold or speedup claim is added.
Authored-motion tests remain separate from expansion-based pixel comparisons.

Log `/tmp/eidolon-aura-populated-native.log`; complete images/HTML/profile archive
`/tmp/eidolon-aura-populated-proof-gnlHRf`, anonymous scanner0, port41960 closed.
Viewed5actor High and20actor High/Low screenshots: visible rings/motes around
all class silhouettes, no enclosing cube. Full client6784 ended143 before a final
summary; its Node process4012607 is absent. The retained log has partial suite
passes, not a complete result, and lint was not reached. Cause is unestablished;
the inspected kernel window contained no OOM report. The unchanged rerun41005
passed258client suites/3635tests129.694s plus lint, Node24.18.0, with separate
`full-{client,lint}-rerun.log` files under the same `/tmp/eidolon-aura-populated-`
prefix. Do not count6784 as passing or silently
replace its incomplete result. No runtime/version/pipeline/push/deployment change.
Prepared populated-reference coverage is now present; native world/death transition
coverage, physical-phone/full-scene performance work and release integration remain.

## Native and rendered verification — September10, 06:42UTC

The earlier pending native run28798 is terminal: journey/expiry passed2/1.3m,
and two-real-player party passed1/45.8s, retries0, frozen fdd28a3. Its process
handle is now absent; the terminal wrapper log establishes success and actual
credential sanitation0. Log `/tmp/eidolon-aura-integrated-native.log`; archived
HTML/results `/tmp/eidolon-aura-integrated-native-proof-obM8eG`. Exact owned
aura-native-0910 API/Mongo/image and ports18560/18561/41960 are absent.

Natural expiry outside town removed the aura and restored base strength10 and
maximum HP/MP100; ordinary town reentry restored strength11, maximum HP/MP110,
full resources and an earned rest bank. The journey also exercised combat,
Recall and fresh login. Both real party actors retained5/4/5 visible meshes,
two batches,16/8/16 sparks and exactly one correctly positioned owner group
through High/Low/repeat-High. Fresh login retained both auras and the local bank.
Viewed portrait High/Low world, status and rejoin images plus expired-outside
and reentry images. These are touch-emulated desktop captures, not real phones.

Native party profiles used ANGLE AMD Vulkan1.4.318/RADV RENOIR,390x844/DPR1,
60warmup and180sample frames per phase. High/Low/repeat-High median frame times
were16.7/16.7/16.7ms; p95 33.3/16.8/33.3ms; p99 33.4ms for all three.
CPU-loop medians14.2/12.5/12.2ms, median full-scene draws423/414/423.
No matched unbatched native baseline was run, so these are workload observations,
not an FPS improvement or a supported-phone performance result.

Controlled comparison rerun91295 passed1/6.5s, retries0, same fdd28a3 and GPU.
High incremental draws9/10/10 versus37/38/38; Low8 versus20 at all three phases.
All six RGB comparisons have exactly0 difference with nonzero aura signal.
Log `/tmp/eidolon-aura-integrated-gpu.log`; archive
`/tmp/eidolon-aura-integrated-gpu-proof-L4agNt`; anonymous artifact scanner0 and
port41960 closed. Viewed both quality PNGs. This confirms the merged baseline's
controlled draw/pixel result, not only the older prototype's result.

Added a prepared real-WebGL lifecycle check in
`tests/e2e/well-rested-gpu-lifecycle.spec.js`. The observation-only helper forwards
the original buffer upload unchanged, associates typed-array identity with the
actual bound WebGLBuffer, and restores the method afterward. Its five unit cases
cover arguments/return/receiver, array identity, both bindings, unsupported inputs,
error propagation and property restoration. Focused19tests/3suites passed1.719s
plus lint. Logs `/tmp/eidolon-aura-gpu-lifecycle-{unit,lint}.log`.

Rendered run46400 passed1/9.9s on RADV RENOIR, retries0. Forty snapshots exercise
three quality/migration/clear/stealth/dead/inactive/expiry/reentry cycles through
real Actor attached-effect synchronization. All24 retired effects' three owned
GPU buffers were observed while allocated and then absent according to
`gl.isBuffer`; current/neighbor buffers and shared geometry stayed valid.
Every visible state contributes nonzero rendered aura pixels and retains all
sparks, matching position and one owner group. Final actor cleanup deletes all
remaining owned aura buffers. Log `/tmp/eidolon-aura-gpu-lifecycle-native.log`;
archive `/tmp/eidolon-aura-gpu-lifecycle-proof-2d7wRR`, anonymous scanner0 and
port41960 closed. Viewed dead/stealth suppression and final-restoration PNGs.
The prepared dead-state image tests aura suppression, not death animation;
effect-group migration is not a complete live realm transition. These checks do
not measure GPU memory bytes or grant/expire any actual player's buff.

Full rerun61718 passed257client suites/3632tests132.882s plus lint underNode24
after the new test files. Logs `/tmp/eidolon-aura-gpu-lifecycle-full-{client,lint}.log`.
Runtime/server code is unchanged. Required remaining gates include equivalent populated-scene
reference comparison, native world-transition coverage, measured broader scene
performance and physical-phone work, then pipeline integration/versioned release
only after the separate release60 acceptance. No promotion, push or deployment.

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
