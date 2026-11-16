# 1.14 atlas and feedback — source preflight

Read-only source review while 1.13 awaits its hardware window. This is not
1.14 implementation or acceptance; deploy/verify 1.13 before advancing releases.

## Confirmed integration points and gaps

- `src/ui/WorldMap.js` owns separate realm rectangles, zone labels, dungeon
  markers and fence segments. Its Earth east/west segments are continuous,
  whereas `server/internal/game/world.go:spawnFence` leaves Fire/Air openings
  at z180–220. Canonical boundaries must preserve these passages and town's
  four exits, not decorate over them with invented coastlines or paths.
- `src/ui/Minimap.js:getRealmForPosition` calls a 120-radius circle around
  (0,200) town; `server/internal/game/safe_zones.go` defines Lanternhold's
  actual safe rectangle x[-100,100], z[100,300]. Environmental tint is not
  proof of safety. Separate biome presentation from accurate safe-zone extent.
- Four actual clickable entrance models already exist, not just atlas dots:
  `src/art/ProceduralDungeonEntrances.js` definitions and
  `src/world/WorldGenerator.js:createOverworldStructures` at Earth(800,200),
  Water(0,-1400), Fire(-2400,200), Air(2400,200). GameEngine movement/runtime
  identifies their dungeon type and requests authoritative status. Reuse these
  definitions when reconciling map coordinates; never confuse the approach
  location with the private interior or its crystal chamber.
- The 1.12 shared registry covers only Ilyra, Guide and the resonance portal.
  Town service config, existing entrance definitions, Chronicle investigations
  and Dark Realm content still own other locations. Extend validated projections
  deliberately; do not make a second independent master list of coordinates.
- WorldMap already supports drag, wheel, touch pan/pinch, zoom buttons and
  Find me. It has in-memory visited chunks, not evidence of persisted per-character
  discovery state. Preserve current known services; do not add punitive fog.
  Legend/category filtering, searchable accessible location list, marker detail,
  personal waypoint and offscreen direction/distance need implementation.
- WorldMap already dispatches DarkRealmMap/CasinoMap and has dungeon-room and
  party drawing. Preserve those instance-specific views and their existing
  privacy rules. A waypoint is guidance, never auto-movement or teleport access.
- Existing reports flow from `UIBindings.onReportSubmit` through `MsgReport`
  in `server/client_dispatch.go` and `server/report_store.go` into the database
  report queue. Protocol policy requires a character, limits payload size and
  rate; database validates category and caps text at 4000 runes. Reuse this
  operator queue. UI currently clears/closes after invoking its send callback,
  before persistence acknowledgement; preserve drafts on failure/offline.
  Add bounded build/area context, explicit opt-in diagnostic preview and clear
  success/failure behavior without chat dumps, credentials or player-state dumps.

## Implementation and proportionate evidence plan

1. Shared validated geography/entrance/service data; test actual fence openings,
   safe-zone boundaries and projections against server/source authority.
2. Cached code-rendered dark-fantasy cartography with readable zoom priorities,
   accurate existing routes/terrain and shapes as well as colors. Do not count
   planned 1.15–1.17 roads or sites as already present in the world.
3. DOM legend, filters, search/detail/list and personal waypoint; consistent
   minimap/atlas transforms and instance separation. Keep hidden discoveries
   and private encounter data out of visible/searchable markers.
4. Existing report queue integration with consent, bounded context and retained
   draft; local test report reaches operator view without live spam or private data.
5. Focused data/input/visibility/report tests, inspected desktop/phone-sized
   atlas views, keyboard/touch interaction and no game movement beneath gestures.
   Reuse unchanged casino/dungeon/campaign evidence; synchronize notes/version,
   publish, let Luna watch CI, verify exact live identity/assets before acceptance.

Roadmap scope remains authoritative; this source checklist neither closes later
world-population requirements nor substitutes a canvas picture for usable places.
