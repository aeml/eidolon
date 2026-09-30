# Alpha 1.42 — environment integration candidate

Local preview, not deployed or a final milestone sign-off. Earlier releases
remain queued; this does not skip their live verification or open closed beta.
Human campaign/pacing observations remain playtest-owned, not a new code
publication permission requirement.

## Draft patch notes

- Made Earth birch/willow/pine crowns fuller at gameplay zoom with overlapping
  leaf and needle sprays, retaining tree locations, clearances and High/Low
  triangle counts. See the [canopy review](2026-09-29-woodland-canopy-mass.md).

- Refined Earth trails with subdued embedded gravel, shallow crevices and
  clearer worn tracks, retaining existing path geometry and walking space.
  See the [road material review](2026-09-29-bastion-road-verges.md).

- Reduced off-screen terrain and fern/sedge rendering without removing plants
  or altering the terrain surface. Sampled Low road views now meet geometry
  targets; High and frame-time acceptance remain open. See the
  [surface-culling comparison](2026-09-29-terrain-surface-culling.md).

- Added broad roadside banks to the opt-in Earth elevation candidate, with
  matching client/server ground and preserved level entrances. Normal worlds
  remain flat pending terrain acceptance. Fixed touch movement retaining the
  previous tick's ground height after moving on slopes. See the
  [landform comparison and remaining budgets](2026-09-29-bastion-terrain-banks.md).

- Framed the Bastion road with staggered woodland stands while preserving
  existing trees, open lanes and saved-position escape. Low retains all trees
  with simpler leaf surfaces; finer culling limits off-screen work. Some High
  budgets remain unmet. See the [woodland review and cost](2026-09-29-bastion-woodland-edges.md).

- Gave the Stranded Flotilla distinct damaged hulls, weathered timber, squared
  frames, abandoned rigging and folded torn sails. Walking bounds are unchanged.
  See the [wreck-site review](2026-09-29-stranded-flotilla.md).

- Combined the resonance plaza's static stonework and trim into fewer draws,
  retaining its appearance, crystal repair effects and interaction. Full-view
  comparisons save24 High/12 Low draws; some town budgets remain unmet.
  See [plaza comparison and culling tradeoff](2026-09-29-resonance-plaza-batches.md).

- Repositioned the main and fill lights for clearer lit/shaded faces and visible
  ground contact shadows. Fitted the shadow region to the view instead of a
  symmetric square. Regional palettes and brightness controls are unchanged;
  some scene rendering budgets still need work. See the
  [lighting comparison and remaining cost](2026-09-29-cross-lit-world.md).

- Fixed graphics-quality changes retaining the previous shadow resolution.
  Low now releases unused shadow and postprocessing buffers; switching back
  restores the effects without accumulating those textures. See the
  [quality-transition regression](2026-09-29-graphics-quality-resources.md).

- Tightened woodland rendering batches so fewer off-screen canopies are drawn,
  retaining all trees, shadows and collision. The sampled desktop road views
  submit20–51% fewer triangles; this is not a measured FPS guarantee. See the
  [culling review and appearance comparison](2026-09-29-woodland-culling.md).

- Connected the long Bastion road with irregular meadow verges, reducing
  empty stretches between landmarks while retaining clear roads, junctions
  and starter combat space. See the [road review and rendering cost](2026-09-29-bastion-road-verges.md).

- Rebuilt the Returning Scar's three investigation clues to match their story:
  severed wood, a bending sapling and the interrupted command inscription with
  its broken seal. Natural boundary stones and grounded roots replace the
  older placeholders. See the [grove review](2026-09-29-returning-scar.md).

- Rebuilt Mara's diary cottage and abandoned garden with weathered masonry,
  broken roofing, a readable ledger table, nursery pots, planted beds and a
  constructed wheelbarrow. Existing walking and interaction bounds remain
  unchanged. See the [cottage review](2026-09-29-keeper-cottage-and-garden.md).

- Fixed multiplayer's retired orange fence blocks overlapping Lanternhold's
  new palisade. Existing collision and network behavior are preserved. Verified
  with an ordinary town-to-starter-fight route; see the
  [connected route review](2026-09-29-connected-starter-route.md).

- Earth's fern and sedge beds gain rooted wind sway, spatially varied gusts
  and restrained flutter. Reduced motion disables the sway; walking space,
  plant counts and terrain height are unchanged. See the
  [woodland wind review](2026-09-29-woodland-wind.md).

- Earth soil and meadow surfaces gain finer, lighting-responsive aggregates
  and restrained material variation, reducing the flat color wash without
  changing terrain geometry or movement. See the
  [soil response review and shader cost](2026-09-29-earth-soil-relief.md).

- Gloamwood trees gain bent, tapered stems with connected forks, smaller shaped
  broadleaves and finer pine sprays. Existing tree placements and walking
  clearances are preserved. See the [woodland review and geometry costs](2026-09-29-woodland-stems-and-leaves.md).

- Earth roads gain coherent compacted soil, worn tracks, gravel shoulders and
  matching normal/roughness detail. Low retains the same features at reduced
  texture resolution; travel routes and collisions are unchanged. See the
  [trail-surface review](2026-09-29-earth-trail-surfaces.md).

- Lanternhold's orange rail fence becomes weathered timber palisades with
  iron fittings and lantern-marked gates. Existing openings and collision
  bounds are unchanged. See the [perimeter review](2026-09-29-lanternhold-perimeter.md).

- The first road east of Lanternhold gains a stranded supply wagon and a
  planted verge, with clear starter fighting space and open travel routes.
  Cart walking/spawn/landing bounds match the new model; ordinary encounter
  rewards and safe zones are unchanged. See the
  [starter-road review](2026-09-29-starter-road-composition.md).

- Lanternhold's service court gains planted stone beds, benches and framed
  lanterns beside the market/smithy approaches. Walking solids match the
  visible furniture and service routes stay open. See the
  [street-edge review](2026-09-29-lanternhold-street-edges.md).

- Casino exterior windows now sit in front of the walls, with recessed arches,
  stone framing, a rose window and a ridged hip roof. The overdoor facade no
  longer exposes the old shell interior. Placement, door and shared casino
  rooms are unchanged. See the [town exterior review](2026-09-29-lanternhold-gathering-court.md).

- Lanternhold's oversized radial paving becomes human-scale weathered
  flagstones with a modest Fourfold engraving. The casino name becomes a
  smaller facade plaque above its unchanged clickable door. See the
  [town square review](2026-09-29-lanternhold-gathering-court.md).

- Tempest Spire gains a west-facing carved threshold, lower masonry needle,
  chamfered foundation and restrained lightning. The road/arrival moves15m
  closer so the portal reads at normal desktop and phone zoom. Legacy bounds
  and dungeon entry rules stay unchanged. See the
  [Air entrance review](2026-09-29-tempest-entrance-alignment.md).

- Gloamwood gains taller, broader woodland crowns with clustered leaves and
  low spreading bracken/sedge beds along the reference routes. Trunk locations,
  walking routes and collision contracts are unchanged. Low keeps a matching
  subset. See [woodland layers and costs](2026-09-29-woodland-canopy-floor-layers.md).

- Abyssal Well gains an open carved foregate, a nearer visible portal, a lower
  silhouette and dark well water. Its arrival marker and road end move16m
  closer; legacy bounds and admission stay unchanged. See the
  [Water entrance review](2026-09-29-abyssal-entrance-alignment.md).

- Molten Core gains an east-facing carved foregate, constructed barrel vault,
  linked chains and a lower visible crown. Its public approach marker and road
  end move8m closer for phone visibility; gameplay bounds and entry rules stay
  unchanged. See [Molten entrance review](2026-09-29-molten-entrance-alignment.md).

- Water/Fire authored places gain regional reed and dry-grass edge beds,
  arranged around scenery while preserving paths, interactions and hazard
  visibility. Low uses fewer plants at the same positions. See the
  [edge-bed review and resource budget](2026-09-29-elemental-location-edge-beds.md).

- Water and Fire ground gains coordinated mineral, frost/ash, normal and
  roughness detail. Revised directional lighting reduces ambient wash while
  preserving regional color and readable shadows. No terrain geometry or
  hazard changes. See [ground/light review](2026-09-29-elemental-ground-and-light.md).

- Dungeon entrance masonry now uses the same detailed surface treatment as
  Lanternhold, with regional stone, weathered blocks and slate.
- Five dungeon themes gain subtle masonry relief and varied roughness on floors
  and walls. Existing colors, encounter glows and navigation remain unchanged.
- Realm gateway ground now reaches the shared boundary, removing the narrow
  exposed-water stripe across open crossings without changing shorelines
  behind fences or adding collision blockers.
- Lanternhold Casino gains stonework and slate roofing to match its neighbors.
  Its entrance label, clickable door and separate interior remain unchanged.
- The Cold Communal Kiln gains constructed masonry furnaces with recessed
  fireboxes and open flues, pottery drying shelves and worn loading-yard paving.
  Hessa's quest workshop uses the matching kiln treatment. Existing roads,
  quest interactions and collision footprints remain unchanged. See the
  [kiln workshop integration record](2026-09-29-kiln-workshop-composition.md)
  for bounded desktop/phone evidence and remaining visual limitations.

No damage/cooldown, item, reward, progression or casino-money rebalance.
Supporting warning/contact/effect presentation is included with the shared
terrain consumers; broader cast, gait and enemy-animation work remains1.43.
Added tree trunks use existing walking/spawn/landing contracts. Characters
returning inside a trunk can use normal collision recovery; no save rewrite
or town teleport was added. The earlier well/paving correction shipped in1.35.

## Validation and limits

See [the environment preflight](2026-09-29-1-42-environment-integration-preflight.md)
for exact checks, before/after evidence, map-memory costs and remaining review.
Validated locally: entrance/interior High/Low galleries, 30 real-coordinate
dungeon/raid layout fixtures, realm gateway surfaces, town service/event
clearance and four-realm authored-location galleries. Layout fixtures are not
earned combat clears; gallery views are not claims about mobile performance,
final world density or AAA art acceptance. Public deployment verification is
not yet applicable to this candidate. Normal-DNS IPv4 public checks work for
accepted1.39; the separate IPv6/DDNS issue remains owner-deferred. No new
production release is claimed.

## Ordered integration record

Built /tmp/eidolon-1-42-release-20260930 from the clean1.41 candidateae6f8678,
including preserved website commitad22dea7 and the1.40 publication receipt.
Integrated initial surface/gateway, Dark Realm evidence, Bastion architecture
and woodland material/composition commits as1ea8eecf,be8985f8,aacef818,66635f00.
The animation-stage script conflict was resolved as the union of the existing
rigid-batch check and incoming surface/gateway cases. Imported only the seven
town architecture/courtyard source and related test files from01be9903 as
aea5d4da; this avoids replacing newer1.41 batch code with the earlier duplicate
or importing future hit-reaction tests without their implementation.

Completed the environmental construction/refinement and shared-consumer
integration against048aec6e through75d4e573. Actual source comparisons show
that all world/region/scenery/material/lighting data and generators, plus the
server's terrain/population implementation, match the integrated reference.
Remaining actor/combat-family differences are intentionally staged for1.43;
audio and broader desktop interface changes remain1.44/1.45. The preserved
1.41 batch helper differs only by a blank line from the reference.

The first terrain-only cherry-pick exposed prerequisites in warnings/effects
and actor contact presentation. Aborted only that owned cherry-pick and
integrated1c4c2d24/14370800/c98020fd first, then the full terrain consumers.
This keeps shared presentation dependency-complete rather than leaving
undefined helpers/imports. The contact-shadow merge was resolved to include
only contact rendering: future corpse and loot-label references were excluded.
Retained the ordinary connected-route fixture instead of deleting coverage
when its original desktop-UI parent was not yet staged. No gameplay checks or
collision tolerances were loosened to make this assembly pass.

Runtime/package/login/default build/CI identities now agree on1.42.0, and the
newest cumulative notes disclose the integrated scope and its boundaries.
Website files remain exactly equal to the other agent'sad22dea7 commit.
Publication still waits for ordered1.40/1.41 acceptance and a fresh remote
fetch/merge. This is a prepared release, not an accepted live1.42.

## Consolidated integration verification

- All three generators pass check mode:520 scenery spawn exclusions/eight
  readings,11 terrain forms/eight preserved landings,18 outcrop polygons and
  139 client-generated movement/hit parity vectors.
- Existing shared-placement, terrain/grounding, quality-resource, replicated
  fence, population/returning-position, equipment-replication, projectile,
  contact-shadow, warning and version suites pass382 checks in47.555s.
- Selected server elevation/grounding/rocks/woodland/population/overworld/admin
  integration checks pass6.725s. No new full encounter or campaign replay.
- Full lint, shell syntax and whitespace checks pass.
- One ordinary multiplayer desktop town-to-starter-fight route passes58.1s
  (56.3s test), with real ground clicks, clear path assertions, replicated
  fence ownership and earned enemy death; no level/gear/position/outcome grants.
  Runenv142route0930 built75d4e573-dirty/Alpha1.42.0 with the default flat
  profile. Inspected town and Attack captures at
  /tmp/eidolon-1-42-release-20260930/test-results/desktop-presentation-gamep-97554-ter-fight-with-the-real-HUD.
  Credential artifact scan passes with zero sanitizations; run-owned API/Mongo
  containers/data were removed and an exact-name container check is empty.

Previously accepted region/entrance/interior High/Low galleries and layout
fixtures are reused because their production art now matches the reference;
the new check focuses on the assembled game seam. It does not prove a dungeon
clear, party balance, real-phone frame rate or human enjoyment.

Final modern-art quality, representative High budgets and authored actors
remain open. High woodland exceeds the retained250k triangle target; Low
reference views fit their current budgets. Current normal-camera capture
still has visibly procedural actors and broad quiet ground. Do not promote
these facts to Q/CB acceptance. No QA-only raised-terrain profile is enabled
in production: main's default flag is false and explicit activation requires
a configured QA allowlist. No schema/save/access reset or beta transition.

## CI integration correction

CI36651506461 atc9388afe failed Browser Smoke2/3 on the rendered Chronicle
move-only fixture. The identical local case reproduced the failure. Its click
was at the retired stone disk's ground-level center;1.42 replaces that disk
with a bending sapling. The fixture now clicks the visible trunk and first
asserts that the exact native CSS pixel hits its real rendered geometry.
Ordinary clicks must still interact twice; Shift-click must still clear pending
interaction/ability state and move once, without jumping. The ground assertion
now compares the actual ray-plane point for that same integer pixel rather
than the retired disk's origin. No production picking/collision rules or test
retry policy were weakened. The corrected case passes3.7s; scoped lint and
whitespace pass. Evidence:/tmp/eidolon-1-42-marker-pixel-0930.

This is a changed-condition publication, not a blind retry of the failed run.
1.41 remains independently accepted;1.42 still requires its corrected CI and
exact public release verification before any later candidate is published.

Subsequent completed-job logs exposed three client fixture mismatches, all
reproduced locally: a plain player harness lacked the real Actor grounding
method now invoked after phone movement; the initial reflection assertion
preceded the regional cross-light preset; and the old225-degree walking
endpoint is exposed by the lower Bastion silhouette. The harness now uses
Actor.prototype.groundToTerrain with its real engine owner, reflection tests
assert the initial regional value and1.9-ambient normalization, and the seven
collision-clear walking waypoints end at210 degrees behind the west tower.
A direct geometry probe confirms real occlusion there; the collision and
occlusion assertions remain. Four relevant suites31checks pass2.18s; scoped
lint and whitespace pass. No production behavior was rolled back for tests.

Go CI also reported TestElevatedSeraphSpawnAndFollow. A local isolated trial
passed, revealing a seed-dependent fixture: the full populated world can
place a hostile within the summon's15m aggro range, legitimately switching
it from follow to smite. The follow/grounding fixture now removes random
hostiles before the summon is created, retaining cast success, spawn height,
five grounded AI steps and a stronger decreasing owner-distance assertion.
Combat acquisition behavior remains unchanged and separately covered.
The follow, root/slow/lifetime, ordered elevation movement and jump-grounding
selection passes five iterations in1.543s. This bounded repeat checks the
identified spawn-seed seam; it is not a dungeon/raid soak or production change.

## Predeploy navigation correction

CI36653110719 at e7bb7df8 passed Go, Jest and all three browser shards, but
failed the disposable predeploy combat/loot case before deployment. Its
town-exit helper demanded a full30m Ctrl-click endpoint that was not available
as an unobscured canvas destination. The failure lacked numeric projection
diagnostics. An unchanged local route with diagnostic-only additions passed;
the precise CI view/seed condition therefore remains unproven, not conclusively
attributed to a game regression or a fixed root cause.

Route planning now explicitly chooses a visible prefix of at least8m before
requesting a jump. Execution still reprojects that entire chosen destination
with scaling disabled, sends a real native Ctrl-click, and requires directional
server movement and a completed landing. The20-step bound and actual east
fence clearance remain. Covered, invalid or tiny planning results send no
movement. Failure diagnostics expose only coordinates and projection data.

The final planner-enabled disposable release-smoke run142smoke0930c passes
all four existing cases in1.5m: login/UI/reconnect, earned overworld kill/loot
with dungeon/persistence, portal entry/exit, and recoverable bag drop plus
Journal tracking. The combat case completes31.6s. Credential artifact scan
passes with zero sanitizations; the wrapper cleans its run-owned containers
and data. This verifies the changed native-input seam, not campaign pacing,
an entire dungeon clear, or absence of every possible CI navigation failure.
The strict helper/projection/failure unit checks and new CI remain required.

## First-party login font correction

CI36657023723 at0dcb1fd3 is terminal failure: Go, Jest and all three browser
shards passed, but login/reconnect captured console ERR_NAME_NOT_RESOLVED.
The other three disposable smoke cases passed. Deployment was skipped and
accepted production remains1.41. The CI console message does not identify its
request URL, so the exact failed CI request is not conclusively attributed.

The only external font stylesheet was Google Fonts Cinzel. An anonymous Chrome
regression blocking that service's DNS reproduced the identical console error
before the change. Bundle the unchanged pinned Cinzel variable font locally,
preload it, serve its correct MIME type, retain the complete OFL/source notice,
and keep the existing typography weights. No browser-error filters, retries,
navigation assertions or website files are changed. The125468-byte asset's
SHA256 isf4d83d34d1f6c741193e4acf4b3dff9531e5a67b6aa65228d00a7db72a4e0f34.

Four font/version/asset-boot suites332checks pass2.644s. The browser regression
is registered once in the existing required interface suite and demands both
400/700 loaded faces, same-origin successful font responses, zero external font
requests and a completely empty strict error collector. Its pre-change failure
and fixed result are retained at /tmp/eidolon-1-42-font-dns-before-0930 and
/tmp/eidolon-1-42-local-fonts-0930. Final browser/lint results follow below.
This removes the reproduced external-service failure dependency, not proof
that every transient CI or network error has been eliminated. Fresh remote
integration, new CI and independent exact public acceptance remain required.

Final System Chrome regression passes4.0s (6.2s total) with both actual faces
loaded and strict collector empty. Evidence:
/tmp/eidolon-1-42-local-fonts-final-0930. Scoped ESLint and whitespace pass.
Reuse the prior earned four-case smoke evidence for unchanged gameplay;
required CI will run the assembled smoke before any production deployment.
