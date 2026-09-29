# Alpha 1.42 — environment integration candidate

Local preview, not deployed or a final milestone sign-off. Earlier releases
remain queued; this does not skip their live verification or open closed beta.
Human campaign/pacing observations remain playtest-owned, not a new code
publication permission requirement.

## Draft patch notes

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

No combat, item, reward, progression, casino-money or saved-character changes.
The earlier town well/paving depth correction remains part of prepared 1.35.

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

## Ordered integration in progress

Built /tmp/eidolon-1-42-release-20260930 from the clean1.41 candidateae6f8678,
including preserved website commitad22dea7 and the1.40 publication receipt.
Integrated initial surface/gateway, Dark Realm evidence, Bastion architecture
and woodland material/composition commits as1ea8eecf,be8985f8,aacef818,66635f00.
The animation-stage script conflict was resolved as the union of the existing
rigid-batch check and incoming surface/gateway cases. Imported only the seven
town architecture/courtyard source and related test files from01be9903 as
aea5d4da; this avoids replacing newer1.41 batch code with the earlier duplicate
or importing future hit-reaction tests without their implementation.

This is a partial staged integration, not complete1.42. Remaining environmental
construction/refinements, shared terrain/placement consumers, saved-character
clearance, quality/resource fixes and the connected normal-camera review still
need reconciliation against the integrated art candidate048aec6e. Reuse accepted
scene evidence; check changed integration seams after the full set is assembled.
The preview currently retains1.41 runtime identity; do not publish until scope,
final1.42 metadata/notes and ordered predecessor acceptance are ready. Final
modern-art quality, representative High budgets and authored actor acceptance
remain open; no QA-only raised-terrain profile is enabled in production.
