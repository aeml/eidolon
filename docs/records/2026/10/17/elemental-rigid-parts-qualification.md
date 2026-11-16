# Generated Fire/Air enemy rigid-part qualification

The ten generated Cinder Wastes and Stormcrown enemy constructors merge immutable
siblings inside their live animation pivots. Original triangles, UVs, material
values and identities, animation bindings, combat radii and interaction bounds
remain. Supplied/imported actors are unchanged. No scenery or population is
removed, and these types do not gain eligibility for the separate actor instance
batches or authored-player geometry worker.

| Creature | Original meshes | Merged meshes |
| --- | ---: | ---: |
| Sandstorm Djinn | 63 | 23 |
| Magma Golem | 80 | 32 |
| Scorched Wraith | 60 | 23 |
| Infernal Behemoth | 49 | 22 |
| Phoenix Sentinel | 78 | 23 |
| Storm Harpy | 60 | 33 |
| Cloud Elemental | 69 | 23 |
| Thunder Roc | 82 | 23 |
| Tempest Giant | 83 | 28 |
| Cyclone Avatar | 82 | 24 |

The common constructor helper accepts explicit preserved part/parent names.
Actual Phoenix/Roc beak meshes remain directly addressable for attack anatomy.
The Harpy's two angled arm parents retain separate feather bounds: unrestricted
merging inflated its conservative box past the unchanged 2.75 m radius. Merging
precedes reset-pose capture, so pooled resets retain only the actual render tree.
Other helper callers retain their original default behavior.

534 focused checks across fourteen suites and full lint pass. They cover every
triangle, normal and UV under nonuniform transforms, all five real clips at three
phases, material identity, shared bounded geometry caches, independent poses,
pooled reset, default bounds, contact anatomy and interaction/target paths.
The original minimum source-detail counts remain checked on the raw recipe;
default-model bounds and the original named-anatomy assertions stay unchanged.
The initial broad trial's one bounds and two missing-beak failures are retained.
Three negative controls reproduce why the explicit preservation is necessary.
The gameplay worker remains byte-exact at
`28b738eaf5aa3a9ba5df513fbd8c400f3d82a5f0f2624d529731c57b80a95f03`.

Forty native image cases cover **1,200 views**: ten types, High/Low, clustered and
ordinary-scale framing, five states, two phases and three directions. The existing
DemonOrc constructor thresholds remain: mean RGB error below 0.1 and fraction of
pixels differing by more than eight below 0.001. These are not pixel-identical
constructor images. Reference restoration is exact, every view retains its
triangles, and calls decrease. Factories return the intended merged models without
fallbacks, and canvases retire. The Harpy's first Low cluster had only 739 visible
pixels; its closer framing meets the unchanged >1,000 requirement. The empty
anchored-selector launch is retained. The old 22-mesh Roc results are superseded
by separate qualification of its final 23-mesh model with a real beak.

Twenty bounded render-cost cases use four walking actors, High/Low, and A/B/B/A
windows of 32 normal RAF renders: **2,560 total frames**. Switching/compilation
remain outside samples; inactive groups detach outside windows. CPU measurements
cover the actual RenderSystem render call, including submission and its normal
callbacks. Mixer work is equal and outside CPU timing. Every candidate median is
lower than both source medians; draws decrease and triangles remain exact. This
is component CPU evidence, not GPU duration or whole-game FPS acceptance. The
mandatory release stage runs image checks; cost observation is explicitly opted
in for this change, not a per-release soak.

Unchanged Djinn evidence is reused after an independent rendered-tree signature
comparison against its earlier native source. Transforms, visibility/shadow/order,
exact geometry/index bytes, material values and alias structure, metadata and real
clip bytes match (UUIDs excluded). Signature SHA-256:
`25ac6f9a31c35ba331662d62e25e3974a8c53ba268d4514c3aca82bb95346809`.

Ordinary-input integration at `2588121626b6f586fe36a84f6e801bf7514eb04c`:

- Fire reaches Molten in 191.421 seconds: 1,879 captured frames and 225 alive,
  grounded, fourteen-slot observations. All four regular Fire families are
  observed using the intended merged constructors with zero invalid/fallback
  roots. The subsequent four-class socket party and save/race check pass.
- Air reaches Tempest in 188.280 seconds: 1,752 frames and 236 equivalent
  observations. All four regular Air families are observed with zero invalid/
  fallback roots. Its party and save/race check also pass. Phoenix/Cyclone receive
  component/factory qualification; these walks do not claim to encounter them.
- Moving draw peaks remain **492 Fire / 360 Air**, above the retained 350-call
  target. Both observed triangle peaks are 216,818. Separate 180-frame party
  windows report Fire 16.7/33.3 ms and Air **33.2/33.4 ms** median/p95; Air still
  fails the 20 ms median target. Populations differ (120/125 active entities), so
  these are not paired speedup/regression measurements. Original FPS, cold,
  device and full-world findings remain open. No favorable-timing replay occurs.

These are prepared visual walks followed by separate bounded party preparation,
not earned campaigns, encounter clears, final owner art or physical-phone proof.
Original routes/deadlines, all performance limits, gameplay/value/access rules and
population templates remain unchanged. Soak/stress and human pacing/phone
feedback remain deferred. The full completion goal remains active.

Private evidence is retained under the owned elemental actor review worktree's
`.qa-elemental-actors`. Closed route records and HTML reports have four synthetic
accounts scrubbed per fixture; image pixels are not claimed to be redacted. The
first 40-file and intermediate 209-file frozen inventories retain superseded and
failed trials. Final component and integration evidence is retained separately.

Frozen final scoped inventory: **3,810 files**, SHA-256
`e309d165b561d78a2e9be39644f862359684867809237564b2155b104579ca85`.
Earlier first/intermediate inventory digests remain
`b857cab5482549f0383de2cd3c749bb444431893dddb06c968df87e06e27e61e`
and `df0cb91ce0922643da9552d164c2225f16bb6bc9924d6e1ca5d8045426f972a5`.
The final processor verifies both earlier inventories before freezing its own
closed allowlist. Mutable continuation and execution stdout are excluded.
