# Bastion terrain banks — September 29

Local opt-in elevation candidate on fdb0e38a. Runtime remains Alpha 1.38.0;
normal startup remains flat. No release gate waiver or deployment.

## Change and visual assessment

Added three broad Earth landforms beside the Bastion road: a western bank,
southern woodland bank and outer fold. The road now climbs through their
shoulders instead of remaining flat between older isolated hills. Shared
client/server generation preserves the eight landmark pads, town, realm
boundaries and instance-owned ground. No new horizontal blockers, trees,
terrain subdivisions, combat values or rewards.

At road samples x340,470,600 / z200, height changes from 0,0,0.341m to
3.326,1.492,1.410m. Adjacent bank heights are 7.717,9.905,6.856m. The entire
field remains below 20m (17.987m) and maximum grade 0.339108 remains below
the unchanged 0.35 cap. Both runtimes assert the same quantized surface hash.

Inspected matched High western-bank and Low woodland-cut images. Ground
material and scenery follow the banks; the visual difference at ordinary
isometric zoom is subtle. This is improved landform continuity, not final
modern-ARPG visual acceptance. Broad muddy surfaces, procedural actors and
performance remain important unfinished work.

## Bounded evidence

- High desktop and Low phone-sized prepared terrain preview: both passed
  before (21.9s) and after (21.7s). Includes movement/jump, picking, path,
  combat-effect and scenery surface checks; not an authenticated campaign.
- Added three matched road screenshots and rendering counters per quality.
- Seven elevation/placement checks passed; seventeen ground-ribbon,
  outcrop-geometry and integration checks passed (24.406s). An initial command
  misspelled GroundRibbonGeometry's filename; corrected selection passed.
- Seven actor-grounding/jump/instance checks passed (1.009s).
- Go elevation/outcrop/grounding selection passed (0.054s). Existing town,
  boundary, instance and old sample checks remain; added road/bank samples.
- Route coverage now measures predicted and acknowledged server Y against
  the canonical field while moving, not only horizontal arrival.
- The first route attempt stopped on an unchanged town waypoint with a 3.885m
  server arrival error. Consolidated terrain/position reads into one browser
  call, retaining the original arrival tolerance. The next run reached the
  road and exposed a real touch-movement grounding gap: runtime joystick
  movement happens after Actor.update, leaving logical Y one tick behind.
  Ground the final collision-resolved touch position before camera/replication.
  The regression failed at 0.006077m error before this fix; retain its 0.001m
  client/server tolerance rather than hiding the lag with a looser threshold.
- Fixed route passed (47.8s browser / 49.7s runner), covering all nine town/road
  checkpoints and real Bastion entry. Both heights stay within 0.001m of the
  shared surface; the route must actually climb above 2m. This uses prepared
  level 100 and ordinary touch input, not earned progression or a dungeon clear.
  Run `bastionbanks0929c`, build `fdb0e38a-dirty`. Credential scan passed;
  run-owned containers/data removed. Inspected the ordinary road-400 capture.
- Scoped lint and diff whitespace passed.

Artifacts: `/tmp/eidolon-bastion-banks-before-0929` and
`/tmp/eidolon-bastion-banks-after-0929`. Authenticated route captures:
`/tmp/eidolon-bastion-banks-route-0929-iEzJBe/route`.

## Rendering cost and remaining acceptance

These are submitted draws/triangles, not measured frame times. Terrain
topology is unchanged; different heights change scenery/shadow culling.
The preview camera and scene differ from the prior normal-world route.

| Road view | High before → after | Low before → after |
| --- | --- | --- |
| Western bank | 293 / 356448 → 292 / 356416 | 118 / 112936 → 118 / 115166 |
| Woodland cut | 282 / 326152 → 284 / 328042 | 110 / 104761 → 110 / 104761 |
| Outer fold | 267 / 316453 → 268 / 316861 | 123 / 130515 → 124 / 130543 |

All these views exceed the existing triangle targets (250k High / 85k Low).
Do not relax budgets or claim acceptable FPS from passing functional tests.
Further culling/geometry work and visual review are required. Human feel,
physical-phone and progression acceptance remain open; no long soak added.
