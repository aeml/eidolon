# Readable, selectable loot piles

Connected starter-combat review showed small world-space names crossing the
player and one another. Loot now uses a dark plaque with a restrained rarity
edge and lighter lettering. The production render loop lays out those existing
sprites at26px desktop/32px phone height independently of orthographic zoom.
Nearby labels fan into non-overlapping rows, avoid the local player's projected
body and preserve their row after selection. No item, collider or pickup-range
movement is involved. Existing texture reference counting/idle eviction stays.

Layout is bounded to24 desktop/12 phone labels and six rows either side of each
anchor; dense overflow retains its world models, fixed picking volumes, Use
and auto-loot paths. A selected item gets priority. Offscreen/inactive labels
are hidden and do not raycast. This is not a complete loot filter or accessible
screen-reader item list. Labels intentionally render as screen-plane overlays
without terrain depth testing, rather than sinking into the ground when offset.
Existing HUD windows still draw above the world canvas.

Real Chrome clicks exposed a defect missed by sprite-only geometry checks:
another coincident drop's broad hitbox intercepted a displaced label. Explicit
visible label hits now win within the loot priority class only; living enemies
still win over loot, and ordinary world-hit order is retained otherwise.
The actual primary-click and move-to-interact methods remain responsible for
approaching/picking up. No local grant, inventory mutation, server acceptance,
capacity/range or reward rule is added by presentation.

## Evidence

127 focused loot, cache/disposal, elevation, nameplate and ray-priority tests
passed4.753s. Includes stable selection positions, desktop/portrait/landscape
zoom, parent scale, bounded deterministic layout, player exclusion, offscreen
and inactive removal, hidden-label ray rejection and unchanged item/hitbox.
Scoped lint and whitespace checks passed.

Eight existing-file browser cases passed55.4s: two new prepared rendered pile
cases, two existing combat-health cases and four pointer/overlap regressions.
New pile cases click all five coincident item labels through InputManager and
GameEngine.handlePrimaryClick, render after selection, and verify ordinary
movement targets plus still-present items. The test initially used an already
in-range item; its approach fixture was corrected to eight metres rather than
changing the gameplay range. The other initial failure was the actual hitbox
interception fixed above. No new CI job or campaign soak.

Desktop High and phone-width Low captures inspected in
/tmp/eidolon-loot-labels-fixed-0929; final evidence in
/tmp/eidolon-loot-labels-final-0929. These are prepared rendering/input cases,
not network-confirmed pickup, physical-phone acceptance or a full connected
campaign. Existing server/persistence behavior was not changed or re-certified.
No FPS claim, runtime bump, deployment or earlier release-gate waiver.
