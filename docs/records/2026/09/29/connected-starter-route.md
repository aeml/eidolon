# Connected starter route and replicated fence correction

The existing disposable desktop presentation route previously used a protected
encounter waypoint. It now follows the paved town lane around the Votive Market,
crosses the east gate and fights a starter enemy through ordinary browser input.
No waypoint, level/gear grant, direct position assignment, combat protection or
injected damage/pose substitutes for the walk or fight. It checks authoritative
health loss and defeat while the fresh level-one Fighter remains alive.

The first driver attempt projected the next click before the prior move settled;
corrected it to wait for IDLE. The next attempt correctly refused a straight line
through the market building. The final route follows the existing paving via
(8,219), (40,222), (51,209), (100,200), (120,200). These segments were checked
against exported static geometry, and each click rechecks client clearance.
Shift-click uses the game's move-only control; jumping and alternate-path
fallbacks are disabled. No production collision was loosened for the test.

## Actual integration defect found

The connected multiplayer capture showed large orange slabs obscuring the
new palisade. Local WorldGenerator correctly installed the detailed fence, but
replicated Fence entities separately loaded the retired SaddleBrown box mesh.
Scenery-only galleries did not include those network entities and missed it.

The perimeter now declares its exact constructed segment positions/orientations.
Matching replicated fences retain their entity and existing collision lifecycle
but no longer request their own legacy mesh. Gates, absent local construction,
outer-realm positions, changed orientations and scaled fences do not falsely
claim local presentation. No collision dimensions, server fence data, protocol,
movement, saves or rewards changed. Existing duplicate collision registration
is not redesigned or claimed fixed by this visual ownership change.

## Verification

Seven focused fence ownership/batching checks passed in6.235s: all184 local
segments and equivalent half-turns, mismatched orientation/location/scale,
absent local roots, repeated mesh requests, retained remote-only rendering,
old collision parity and construction/batch bounds. Scoped lint/diff passed.

The corrected connected route first passed to confirmed damage in38.9s and
exposed the orange blocks. After the rendering fix, the route including earned
enemy defeat passed in roughly1.2minutes. Gate assertions observe actual
replicated Fence entities using local presentation without a legacy mesh.
The disposable API/Mongo containers and owned data were removed by the wrapper;
no production service was touched. Credential artifact scan passed with zero
sanitizations on the final run. No campaign, dungeon or raid soak was added.

Evidence: `/tmp/eidolon-connected-route-0929-SIyw7B`, including before/after gate
images and canvas-only WebM recordings. Recording is explicitly opt-in with
EIDOLON_E2E_PRESENTATION_VIDEO=1, starts after login, excludes DOM credentials/
chat/account UI and masks the generated player name. It stops after90seconds
at most and releases tracks on completion. HUD screenshots independently hide
chat content and mask the account name. Inspected gate, encounter and defeat
captures plus sampled motion frames. This is not a measured frame-time budget,
physical-phone/party check, human combat-feel acceptance or a full dungeon route.

## Next visible work

The town-to-first-fight section is now exercised together, not inferred from
separate scenery and pose galleries. The first diary investigation still reads
as a crude low foundation and exposed props, and broad ground areas remain
sparse. Improve that connected scene's construction/materials/composition next;
the remaining grove-to-dungeon route and final actor art stay open. Do not call
the whole modern-ARPG slice complete because one walk and fight succeeded.

Local1.42 follow-up only. No runtime bump, deployment, earlier milestone gate
waiver or final visual acceptance. Full ordered roadmap remains active.
