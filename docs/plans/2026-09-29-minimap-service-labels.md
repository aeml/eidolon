# Town radar label readability

Local candidate after daa2b62b; not deployed or complete1.45/atlas acceptance.

The connected town screenshot showed service text colliding at the minimap rim.
The radar now reserves service icons and the player center, then places names
in available space inside its circle. Ready quests, available quests, and then
nearby services receive first choice. Names that cannot fit are omitted on the
radar only; every filtered-in service/quest icon retains its existing projected
or edge-clamped position. Full names/routes remain available on the world atlas.

Small phone radar uses icons without tiny service names. Quest ?/! glyphs remain.
A stronger background separates map text from world signs behind it. No world
labels, NPC positions, service interactions, atlas destinations, navigation
filters, dungeon objectives or casino floor visibility changed.

## Evidence

-29 label-layout/minimap/dungeon/atlas checks pass1.187s;10 casino map/floor
checks pass.814s. Exact canonical service anchors remain covered, with all
service icon strokes retained. Layout checks prove circular containment,
nonoverlap with icons/player/other names, deterministic ordering and no input
mutation. Existing all-names/insertion-order assertions were replaced with
readability/quest-priority assertions; labels cannot all occupy the same pixels.
-The first layout admitted only cardinal offsets, leaving even a prioritized
quest without a place among neighboring icons. Added diagonal alternatives;
kept icon/center exclusion and clipping requirements unchanged.
-One real canvas/browser case passes5.8s: town arrival, market and dungeon-guide
positions, quest glyphs, navigation filtering and phone icon-only behavior.
Final arrival/market images inspected at /tmp/eidolon-minimap-labels-final-0929.
-Scoped lint and whitespace pass. No campaign soak or new server process.

This is prepared production-minimap evidence, not a new connected party run.
Nearby dynamic actors can still cover some map text; rim icons/cardinal letters
can coincide. The patch fixes service-name collisions, not all cartographic or
world-sign quality. No measured FPS claim, version bump or release-gate waiver.
