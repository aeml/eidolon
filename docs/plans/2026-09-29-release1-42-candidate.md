# Alpha 1.42 — environment integration candidate

Local preview, not deployed or a final milestone sign-off. Earlier releases
remain queued; this does not skip pacing/readiness gates or open closed beta.

## Draft patch notes

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
still blocked by the owner's DDNS routing. No new production release is claimed.
