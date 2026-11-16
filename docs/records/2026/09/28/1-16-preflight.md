# Alpha 1.16 — account continuity and Water/Fire population

Source preflight only, while1.15 candidate `c7761130` runs CI36423730242.
Do not publish1.16 before1.15 has passed deployment and independent acceptance.
The full scope remains the authoritative1.11–1.99 roadmap, not this checklist.

## Preserve and verify account continuity

- Inspect `server/client_dispatch.go`, `server/persistence.go`, protocol-policy
  connection fencing, and `src/core/NetworkManager.js`/`src/main.js` resume UI
  before changing them. Existing resume, resource handoff, Well Rested session,
  progression rollback and dungeon-resume tests are prior coverage to reuse,
  not evidence that the full1.16 gate already passes.
- Verify ordinary login/logout, transient reconnect, superseded connection,
  expired/invalid resume token and storage-disabled recovery. The user must know
  whether to wait, retry or log in again, without leaking tokens/account details.
  An old socket must not mutate or overwrite its replacement's character.
- Preserve the explicitly approved15-minute dungeon expiry and latest cleared
  boss checkpoint. No new privilege, grants, reset policy or password-recovery
  service is implied; explain supported operator help honestly.

## Preserve canonical realm content

| Realm | Existing story places | Dungeon anchor |
| --- | --- | --- |
| Water | Flood shelter: `dain_ledger`(-60,-740). False reflection: `still_pool`(-80,-830), `moving_pool`(-68,-830), `mooring_bell`(-74,-840). | `abyssal_well`(0,-1400), existing52m-deep/76m-wide art bounds; derive approach from actual entrance, not its center. |
| Fire | Communal kiln: `hessa_ledger`(-1170,245). Command scar: `cold_ash`(-1180,145), combat `command_anchor`(-1192,145), then `released_ember`(-1186,135). | `molten_core`(-2400,200), existing76m-wide/deep art bounds; preserve entry click/clearance. |

These are two compositions per realm, not one new POI per evidence object.
Resolve anchors from generated investigation/entrance data in implementation.
Keep all saved IDs, accepted-quest requirements, Fire combat prerequisite and
rewards unchanged. Public optional lore must not expose locked story text.

## Implement distinct eight-place sets

Each realm needs its two dressed story places, dungeon approach and another
major landmark, two camps/structures, and two usable optional discoveries.
Water themes: drowned moorings, tide-measuring architecture, stranded vessels,
frost shelter and memory versus ownership. Fire themes: communal kilns, cooling
channels, abandoned workers' shelters, furnaces and warmth versus obedience.
Choose final positions only after clearance checks; these themes are not built
locations and must not appear as map markers yet.

- Extend the existing population/reading/atlas pipeline, retaining distinct
  regional materials, shapes and original lore rather than recoloring Earth.
- Water's nominal central foliage-clear road crosses hazards at(0,-1000)
  and(0,-1950). Fire's nominal road crosses hazards at(-1550,200)
  and(-2750,200), and the Molten Core footprint. A clear foliage strip is not a
  safe travel route. Author flat detours around actual hazard radii plus hero
  clearance; do not invent walkable bridges or move hazards to fit the artwork.
- Water/Fire foliage currently has no collision, unlike Earth. Preserve that
  rule. New solids need explicit client footprints and server random/elite spawn
  exclusions generated from the same recipes. Do not make whole camps safe.
- Every physical trail and available reading/destination must agree with map
  positions, instance visibility and ordinary interaction range. Keep narrow
  inspection approaches, entrance gathering areas and region gateways clear.

## Proportionate acceptance

Structural registry/path/hazard/spawn tests; bounded normal-camera high/low
scene and optional-reading checks; relevant account/session tests and one short
normal reconnect/travel route. Reuse unaffected1.15 UI and first-session evidence.
No full campaign/raid soak. Publish synchronized1.16 notes/version only after
the complete milestone is ready; Luna watches its CI and root verifies live.
