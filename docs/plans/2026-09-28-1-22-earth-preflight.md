# Alpha 1.22 — Earth journey and presentation review

Local prerequisite work, excluded from1.20/1.21 publication. The authoritative
milestone includes Earth quest clarity, investigations, class/equipment preparation,
Verdant progression and its crystal-raid handoff. This arch correction is one
concrete visual gap, not completion of that whole milestone or modern world art.
Actual balance changes still require player evidence; preserve saved contracts.

## Confirmed visual defect and correction in progress

The1.18 normal-gameplay screenshot showed First Grove Arch as square stepped
blocks with a flat lintel and open, constant-radius root tubes. New geometry
uses thirteen beveled vault stones, six worn courses per pier and a projecting
keystone. The piers fit within their exact previous authoritative solids; all
vault geometry is above normal hero clearance. No server footprint changed.

Roots taper with restrained longitudinal variation and small upper branches;
their ground approach stays within the previous envelopes. Fieldstone shading
uses filtered natural grain rather than painting a rectangular brick grid across
the curved vault. Standard material lighting, fog/shadows and ownership remain.
No downloaded textures, extra lights, per-frame mesh rebuilds or gameplay effects.

Initial world checks exposed41 scenery batches versus the existing40 ceiling.
The fix combines all arch stones, including fallen blocks, into the same natural
stone batch. No geometry was removed and no budget weakened. Final16 geometry,
world/clearance/generated-footprint and shader cases pass1.881s. Existing High/Low
footprints and path clearances match; tapered tip/finite-normal and beveled pier
containment tests added.

The first browser pass passed2 cases38.8s, but predates final material batching/
pier courses and is not final acceptance. The second normal-scale Earth/town
High/Low check passed47.4s; its timing sample now includes First Grove Arch in
addition to the four existing sites so the changed view is actually measured.
The changed arch view hadp95=16.7ms at both settings,250calls/172,406triangles
High and99calls/63,250triangles Low. Warmed repeat resources matched exactly.
Inspection nevertheless found the high vault crown cropped at the desktop camera
and roots still too plain/blunt at ground level. The revised segmental vault
keeps its crown under14m, embeds root bases and adds filtered bark detail.
Final17 geometry/footprint/shader tests passed1.744s. The revised browser run
passed both cases in43.2s. Root inspected both final arch captures: the crown
now fits the normal view, with distinct tapered roots and a clear walk-through.
Artifacts: `/tmp/eidolon-122-grove-reviewed/`. Arch p95 frame intervals are16.8ms
High and16.7ms Low;250calls/172,406triangles High and99calls/63,250triangles Low.
Warmed geometry/texture/program counts match before and after repeat exactly:
270/44/38 High,264/31/25 Low. Scoped lint passes. These are desktop GPU results,
not physical-phone evidence or final modern-art approval. Wider Earth journey/
content review is still required; this correction alone does not close1.22.

## Earth objective navigation and retained journey contracts

Source review found a concrete wrong destination: every Earth combat/collection
marker used the regional center (0,200), inside Lanternhold. Setting a waypoint
there sent a player seeking enemies back to town, even though the description
called it a broad search area. `earthQuestSearch.js` now supplies outside-town
search anchors and authored enemy-sector bounds. The opening points to the
ordinary east-gate starter encounter; the level-three hunt points farther out
at175,200; Imps/Constructs point west and Demon Orcs east. Seed guidance explains
chance drops and physical pickup. The Water-transition Construct hunt uses its
actual Earth hunting realm, not its chapter's Water theme. No spawn guarantee,
teleport, dynamic enemy tracking, kill eligibility or reward change is implied.

Ten atlas checks pass1.343s, including exact server sector agreement, every Earth
hunt outside town, minimum-level warnings, collection copy and ready turn-ins
returning to canonical Ilyra. Two actual browser views pass27.3s; the user-visible
hunt selection and waypoint end at175,200. Root inspected the390px capture:
directions, warning, waypoint control and map remain readable and within frame.
Artifacts: `/tmp/eidolon-122-earth-search/`. Scoped lint passes. Initial retained
story/preparation/investigation/atlas checks:45 pass2.506s before this correction.

Reviewed existing contracts, unchanged by this candidate:

| Journey requirement | Current source/evidence and limit |
| --- | --- |
| Opening and three Earth hunts | `quests.go` and `content/chronicle-hunts.json`: Skeleton3 opening; authored Skeleton40/Imp60/DemonOrc50 hunts with3/20/30 minimum enemy levels. Required chapters and manual turn-ins are retained, not shortened to fit a test. |
| Both investigations | `chronicle-investigations.json`: Mara's diary; severed root/new growth/marked stone. Sparse discovery masks, prerequisite visibility, retrospective optional chapters and saved Journal lore covered in retained client tests. |
| Memory Seeds and earned rewards | Eight Seeds; personal world drops in `chronicle_world_drops.go`, progress on pickup, manual claim. Ilyra explicitly holds the repair materials for Maelin. No increased drops, gear grants, XP change or changed saved reward quotes. |
| Preparation and Verdant | Dungeon chapter explains level30 admission, earned equipment, skill/talent spending and optional dailies.1.15 class-primary-stat guidance and1.17 party preparation remain. Existing earned/party encounter receipts retained, not replayed for a version number. |
| Raid handoff | Dungeon completion opens the road, not a restored crystal; Water-transition hunt precedes Water investigations. After all four roads, Rootheart Vigil requires full raid plus Maelin's three waves, then personal turn-in. `QuestConversation.js` resolves inserted hunt handoffs by stable ID. |

Actual player pacing, difficulty and reported ambiguity remain playtest evidence
requirements. This source/functional audit does not prove human completion time
or finish the full modern-art target. No full dungeon/campaign rerun was started.
