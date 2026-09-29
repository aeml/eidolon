# Water/Fire location edge beds

Local candidate following0b76e6b8; not deployed or final art acceptance.
Previous turn completed terrain/light work. Source review confirmed that the
large tree clearings leave authored places isolated from surrounding foliage.
The tree/collision contract stays unchanged; new low cover occupies safe parts
of those clearings instead.

## Draft patch notes

Water's eight authored locations gain low reed/sedge beds; Fire's eight gain
dry grass. Wrecks and dungeon approaches have dedicated edge arrangements.
Other places have broken side/rear patches, with the arrival and gathering area
open. Roads, lore pedestals, story interiors, scenery solids and hazard aprons
remain clear. Low retains an exact subset of High's plant positions.

## Construction and costs

- Original curved, folded opaque blades with vertex-colored bases/tips and
  small Water seed heads. No downloaded assets, texture maps, emissive grass,
  new blockers, rewards or per-frame animation.
- Whole-tuft clearance1.35m, including largest scale, plus road2m, solid.45m,
  hazard8m and reading4m margins. Story center10m preserved. All placement stays
  inside the authored location and realm. Existing server footprints unchanged.
- One scene-owned cover mesh per location, one shared material per region.
  Receive shadows; do not cast subpixel grass shadows. Updated location batch
  ceiling from7 to8 for Water/Fire only; Air retains7. No hidden extra batches.
- Final High:786 Water +957 Fire plants,287,082 triangles total across sixteen
  independently culled locations. Largest additional visible site batch29,160
  triangles. Low:415 +511 plants,47,960 total triangles, maximum4,800 per site.
  Non-indexed position/normal/color buffers add about29.6MiB High /4.9MiB Low
  CPU vertex data, plus GPU buffers when uploaded. This is not free dressing or
  an FPS optimization. No additional map memory.

## Review and checks

First render looked too much like a tidy planted border. Broke bed width/density
into uneven pockets and widened blades at normal play scale. This reduces the
High plant count as well as the repeated-row appearance.

Initial12 focused tests passed30.058s. Refinement batch passed8 existing
population/elevation checks and3/4 new cover checks; the remaining geometry
check caught widened blade bases reaching-.0448m. Clamped the folded edge at
ground height, retaining the original assertion rather than relaxing it. Final
cover suite4 PASS8.759s covers deterministic/Low-subset placement, all clearances,
bounds, finite geometry, per-site geometry budgets and shared disposal. Scoped
ESLint and whitespace checks pass.

Initial desktop/phone review2 PASS23.5s. A later desktop run failed dynamic
module import before scene construction; Low passed. Inspected its network
trace: RenderSystem.js returnedHTTP200, with no captured HTTP error explaining
the failure. Cause remains unconfirmed. The run was terminal before rerunning;
no assertion/retry-policy/server change was made. Final bounded Water/Fire
review2 PASS30.3s at `/tmp/eidolon-elemental-edge-beds-verified-0929`.
Inspected final desktop refuge/wreck and phone-sized kiln views.

This is a prepared world/render fixture, not earned progression, connected combat,
physical-phone or broad performance evidence. Region-wide landforms, stronger
architecture/cloth silhouettes, actor art, richer landscape composition and
human gameplay/art acceptance remain open. Do not equate adding plants with
meeting the owner's modern Diablo/PoE-style presentation target.
