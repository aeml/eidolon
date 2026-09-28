# Alpha1.23 — Water journey review

Separate local work, excluded from1.22 commit `e430528e` and from1.21 CI.
Do not publish until predecessor acceptance. No new campaign run, reward change,
quest reset or production mutation. Human balance remains owner playtesting.

## Confirmed navigation defect

The old region-center marker put Water hunts at0,-1400, the Abyssal Well entry,
instead of the enemy's authored grounds. Trolls spawn in the first snowfield
(-995..-605Z), Golems in the next (-1395..-1005Z). `waterQuestSearch.js` now uses
these actual `spawnSnowWorld` bands and their five-metre margins. The map labels
them search areas, not live enemies. Hunt minimum levels remain50/55; the Pearl
collection starts in the first Water band and explains chance drops/pickup.
The actual dungeon marker stays at the Well; the preceding Construct hunt stays
in western Earth. Ready objectives still direct the player to canonical Ilyra.

## Visual correction

Inspected normal-scale1.16 Tide Rib and Stranded Flotilla captures at
`/tmp/eidolon-elemental-session116-final/`. Tide Rib is visibly two smooth cyan
tubes, with its crown clipped at the normal camera. Replacement geometry uses
two low carved stone ribs with fifteen beveled sections each, fieldstone shading,
visible flood-height notches and iron ties. The old pier solids remain exact;
arch geometry stays above6.9m and below13m. No extra lights, custom frame updates,
downloaded textures or walkable upper platform. Existing Fire span is unchanged.
The boat review also exposed ladder-like, unplanked frames. The local update
tapers both ends, reshapes frames and gunwales, and adds curved surviving planks
with deliberately missing sections. These are closed timber strips, not a deck;
the hulls retain their existing5.5×3×13 solids and central walking aisle. Wider
final environment art remains open; these are not all Water assets.

## Journey contract review

| Requirement | Retained evidence and boundary |
| --- | --- |
| Earth-to-Water route | Stable hunt IDs keep the Construct ferry chapter before Dain's shelter; `ChronicleWaterHandoff.test.js` covers manual claim and reconnect order. |
| Both investigations | Dain's ledger then Still pool/Moving pool/Mooring bell in `chronicle-investigations.json`; sparse server discovery mask controls recorded lore. No raw-count unlock or future-story leak. |
| Hunts/collection | Authored Troll50+ and Golem55+ eligibility; eight Moon-Tide Pearls; personal drops and pickup/manual claims. Current counts/reward quotes and saved catch-up behavior untouched. |
| Bag icon | `ProceduralIcons.js` has the dedicated moon-tide-pearl definition; retained browser icon coverage decodes all eight Chronicle variants at48px. No icon changes in this candidate. |
| Abyssal/raid handoff | Existing actual-family level prefix, Thalorath target and Guide admission remain. The dungeon opens the Confluence road, not the crystal's restoration. Maelin's later three-wave Vigil remains separate. |
| Party preparation | Existing class-specific Uncommon/Rare recommendations, tank/healer/damage guidance, town recovery, ready checks and saved checkpoint/expiry instructions remain in `DungeonPreparation.js`. No forced class composition or lowered entry gate. |

## Local evidence

22 focused Water geometry/search, elemental population and atlas checks pass
4.999s. Tests cover exact spawn-band agreement, normal quest destinations and
manual turn-ins, finite overhead geometry, generated footprints and existing
site/approach budgets. Final37 geometry/search/population/atlas/handoff/party
checks pass6.678s; final scoped lint and whitespace pass.

Four initial real-Chrome atlas/Water/Fire cases passed1.2minutes, including the
actual Golem waypoint0,-1200 and minimum55 guidance. Root inspected the portrait
map: directions and waypoint control remain readable, with normal scrolling in
the destination panel. `/tmp/eidolon-123-water-review/`.

Initial arch inspection caught unsupported outer rib ends. Added overhead
capitals across both ribs without widening ground solids. Final two High/Low
Water/Fire checks passed54.1s, with Tide Rib included in the timed route.
Root inspected both final normal-scale views: the crown fits and both ribs now
sit on visible capitals; central passage remains clear. Final arch frame p95:
16.7ms High /16.8ms Low;185/85 draw calls and144,194/39,911 triangles. Warmed
geometry/texture/program counts match before/after:303/41/35 High,282/27/21 Low.
`/tmp/eidolon-123-water-final/`. This is desktop GPU evidence, not physical-phone
gameplay or final modern-art certification. Candidate versioning/publication
remains after1.22 acceptance. Source is now versioned1.23 with cumulative notes;
final335 focused/version checks pass8.713s, full lint and whitespace pass.

Wreck follow-up:10 geometry/population checks pass4.414s, including finite
normals, tapered ends and planks inside the original hull envelope on both
qualities. Scoped lint/whitespace pass. New High Water/Fire browser case passes
28.1s; root inspected the wreck capture and it now reads as a broken hull.
The Low case stopped during imports before rendering: trace shows
`net::ERR_NETWORK_CHANGED` across multiple modules (RenderSystem itself returned
HTTP200). That failed attempt is not a Low visual pass. One affected rerun
passed26.0s with unchanged assertions; root inspected the Low wreck capture.
No browser failure filter, retry loop or performance threshold was weakened.
Final wreck p95 frame interval16.8ms both qualities,172calls/128,556triangles
High and72calls/21,593triangles Low. Warmed resource counts remain303/41/35 High
and282/27/21 Low, identical after repeat. Final evidence is split between
`/tmp/eidolon-123-water-wrecks/` (High) and
`/tmp/eidolon-123-water-wrecks-low/` (Low). These supersede the earlier hull view,
not the already-accepted map interaction checks.
