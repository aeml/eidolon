# Alpha 1.42 — environment integration candidate

Local preview, not deployed or a final milestone sign-off. Earlier releases
remain queued; this does not skip their live verification or open closed beta.
Human campaign/pacing observations remain playtest-owned, not a new code
publication permission requirement.

## Draft patch notes

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
