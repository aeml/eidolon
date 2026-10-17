# Dungeon entry stone and iron surface finish

Qualified implementation: `2c2af876c3ee3082232fdf407900a6b7474876f1`.
Base: prepared Alpha1.79.76, `b75b0d621320a2b99f03cdb0590d351ee6c8d221`.
This is an isolated, qualified candidate; it is not a public release acceptance.
Merge and publication follow exact76 deployment acceptance.

## Visible change

Entry arches in all five dungeon themes now use the stone and metal albedo,
normal and roughness maps already used by the adjacent vigils and props. The
ward retains its own colors, vertex wear, metalness and mutable material state.
Physical texture projection keeps grain density consistent across individual
courses and the wide threshold. Each triangle uses its geometric face normal
to choose one chart, avoiding collapsed charts on diagonal bevels.

The existing six maps are shared; the change adds no texture, light, draw,
collider, interaction, server rule or geometry. Position, normal, vertex-color,
index/group and bounding-box data match the original ward. The existing animated
veil and room-clear summary still control doorway presentation. Standalone
ward callers can omit the optional shared materials.

## Evidence

- 64 checks across three suites pass; lint passes for both runtime files and
  all three changed test files. Four new client cases cover High/Low map and
  mutable-state ownership, physical texture density and usable bevel charts.
  Existing six-map and nonemissive invariants remain in force.
- Two native AMD/RADV cases pass without retries, skips or flakes. Actual
  production layouts for Verdant, Molten, Tempest, Abyssal and Umbral use the
  production renderer at zoom18, actual desktop/390px HUD and all four supplied
  classes with fourteen equipped slots. Run and CombatIdle snapshots cover
  inactive and ready doorway states: twenty comparisons and forty HUD JPEGs.
- Every comparison has an identical repeated baseline and exact RGBA source
  restoration. Draws, triangles, retained geometries/textures, shadows, veil
  opacity/time and collision data match between source/candidate/restored arms.
  Both opaque ward geometries retain source-exact non-UV data and bounds.
- High observations have166–176draws/139701–156185triangles; Low96–103draws/
  65258–68586triangles. These are prepared snapshot observations, not frame-time,
  sustained multiplayer or supported-device acceptance.
- The baseline ward is exported byte-exact from `b75b0d62`, SHA256
  `fd76987bc0dcf372f8659615c38d433538700949977eb1874c68bf4719c833a3`.
  The canonical179507byte geometry worker remains
  `28b738eaf5aa3a9ba5df513fbd8c400f3d82a5f0f2624d529731c57b80a95f03`.

The frozen58file qualification inventory is
`/home/aeml/.local/share/eidolon-entry-surface-review-20261017/.qa-entry-surface/qualified-evidence-inventory.json`,
SHA256 `c8e9c763626b7d314c03cb837c107c2ed827a6243814c88ea2bc000d1290b9fb`.
It contains selected inputs, qualification code, logs, native reports and images,
and verifies each of the retained parent inventories below. Expected next full
client counts:802suites/12431tests; engine513modules; no added browser case.

## Retained failures and observer corrections

| Packet | Result | SHA256 |
| --- | --- | --- |
| Original plain ward | Eight focused failures, fourteen unchanged skipped cases; shared finish and density regression reproduced | `7b5d33087f1be2a25f35eaf67fa2b77ed8c11e8cac02fca588c187c144309d8a` |
| Initial candidate | Five existing surface cases fail on default emissive intensity1; corrected by inheriting the shared nonemissive setting | `ba5f7f7372150baf8fd2ca5c1c742f72d47b1a4f4acfcdfecf479486a775d9cc` |
| Initial bevel projection | New physical-area regression fails on collapsed UVs; corrected with per-triangle geometric projection | `0a35526154081fb8cf523d469ffa2be6ae0a716bab0142e27c46bb6d8591bd31` |
| Native discovery error | Zero tests execute because the intentionally isolated image has no Git; corrected by reading an exact pre-exported source file | `acb84a6873eafe3ea4d40d26664b19f600b82b9ae75b594eb5d901ea2ce36d60` |
| Native opacity observer | Both cases fail after twenty recorded comparisons: static opacity was asserted after explicitly animating the veil; corrected observer checks the established animation ranges, clock and exact cross-arm equality | `4e9c8111b9d486f7d1c3ca157cca6124f9dfa31325b5560e796a41ceec33f6eb` |

Neither failed native invocation is counted as a passing run. The corrected
observer passes both cases; animation behavior and original test deadlines are
unchanged. No performance target was relaxed.

## Remaining scope

Gameplay-scale desktop and Low images were inspected. The finish is subtler
and more coherent with neighboring props; broad repeating floors and sparse
room composition still require further work. This component does not establish
final world-art quality, continuous character motion, normal-input traversal,
server-earned clearing, physical-phone support, frame-time targets or owner
acceptance. Full original goal, roadmap and beta/release gates remain active.
Soak/stress and owner campaign/phone feedback stay deferred, not passed.
