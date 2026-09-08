# Readable crowd names — unversioned visual candidate

Actual collection images showed tiny overlapping names over packed enemies.
This implements part of the roadmap's combat/phone readability scope; it does
not close1.1/1.2/1.3 or change combat targeting, progression or regeneration.

Entity caches its current NameTag sprite. The render path applies22CSS-pixel
sprite height (about13.5px text with the existing texture padding), independent
of zoom and actor scale. Screen-space overlap suppression shows at most12 names
on desktop/eight on phones. Selected targets have first priority and a warm tint;
NPCs, party members and the hero follow before ordinary names. Stable visibility
within distance bands prevents needless crowd flicker. Labels are placed above
heads and clear independent quest markers without moving actors or those markers.
Offscreen/dead names are hidden; actor meshes, hitboxes and markers remain intact.

World-only QA screenshots suspend this controller while hiding NameTags, so the
next rendered frame cannot re-expose account names during capture. The controller
stores only current IDs/scratch vectors and no external/server state.

Focused45657 PASS75tests/four suites/2.264s plus full lint. Coverage includes
zoom/parent-scale invariance, overlap/priority/stability, dead/offscreen recovery,
marker clearance/no cumulative offset, screenshot suspension and render/HUD
integration. Final selected tint repeat and six actual-rendered High/Low desktop,
portrait and landscape comparisons are pending. This branch is still based on
staged52; no new release number, push or live approval is implied.

Proposed patch-note content when packaged: readable crowd names; highlighted
selected-enemy label; uncluttered party/NPC names; quest markers remain clear.
