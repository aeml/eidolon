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

Final46603 PASS75tests/2.064s and lint20387 PASS. Initial rendered12443 failed
all six cases: the test required Ilyra's name beside the selected label even
though their projected boxes overlapped. The intentionally higher-priority
selected label won. Failure landscape image viewed; desktop/landscape preserved
under `/tmp/eidolon-nameplate-initial-evidence-U3SoO2/`. The corrected component
scene moves only its prepared NPC outside that overlap, using the phone's actual
projection to keep the full name in frame. Both label and marker assertions stay.
No runtime changes followed89f690e; a corrected rendered run remains required.

Corrected rendered90998 on2a66ffa PASS6/29.3s: desktop1280x720, portrait390x844,
landscape844x390 each High/Low. All labels retain22CSS-pixel sprite height,
visible labels do not overlap, selecting another enemy promotes its name, and
repeated frames leave models/quest marker unchanged. Desktop before/after and
both phone after images viewed and archived at
`/tmp/eidolon-nameplate-evidence-BunTb1/`. Labels are clearly readable; the fixture
still has deliberately packed tiny models and an empty ground plane. This is
component evidence, not full-world/physical-phone/model-composition approval.
Full client integration and versioned packaging remain required.

Full client25258 on899c957 PASS224suites/3270tests/170.666s; handle closed.
An optional isolated nameplate-world route now checks actual authoritative town
entry, ordinary Ilyra approach/dialogue, readable label/marker and ongoing frames
in three viewport sizes, without grants. Its screenshot hides player-class names
and DOM transcripts while leaving NPC labels visible. This new actual-world
route and final packaging are not yet verified.

Actual25513 on9b58245 ended1PASS/2FAIL in2.4m. Desktop town interaction and all
label/marker/frame assertions passed10.0s; its account-free screenshot was viewed
and saved at `/tmp/eidolon-nameplate-town-evidence-gGh3DL/desktop-first-pass.png`.
Both narrow cases failed the desktop approach's hover prerequisite before label
assertions. Scan0 and cleanup/independent container absence passed. They did not
use a proper touch browser/joystick route, so this is not a phone gameplay pass.

The correction uses touch/mobile browser contexts (including landscape UA) and
the unchanged joystick/tap Ilyra approach extracted from mobile-quest-gameplay
into a shared helper. Desktop retains its real mouse path; phone checks do not
require nonexistent touch hover. Label height, marker, level-one, live frames and
dialogue checks remain. No production source changed after89f690e. Lint61719
passed; the corrected actual route remains required.

Corrected actual86108 onf00814a PASS3/25.7s: desktop9.0s, portrait6.7s and
landscape7.5s. Actual level-one login, ordinary mouse/joystick approach, Ilyra
dialogue,22px label, gold marker and continuing frames pass. No grants used.
Scan0 and owned cleanup/independent exact-container absence pass. Phone images
viewed, all three retained in `/tmp/eidolon-nameplate-town-evidence-gGh3DL/`.
Other disposable players can remain near Ilyra between these sequential logins;
all player-class names/transcripts are hidden in captures. This verifies town
integration and responsive controls, not physical-device or full-combat approval.
All owned verification handles are terminal. Release packaging/CI inclusion is
the next step, in sequence after the existing release queue; no push here.
