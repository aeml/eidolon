# Wearable runtime-copy pilot

This is staged1.87 work, not an active asset catalog or complete equipment pass.
Keep delivered fitted models and provenance untouched. Use the existing pinned
dependencies from `package.json`; the task can instead provide a separate
`EIDOLON_ASSET_TOOL_MODULES` directory containing those exact versions.

Create a new owned output directory, then run from the repository root:

```sh
node scripts/derive-wearable-pilot.mjs 'Plate Mail' Fighter /absolute/new/pilot-directory standard
```

The generator validates the delivered manifest hash, preserves exact rig and
node-transform contracts, derives High/Low files and rereads them. It refuses
existing output files or the original source directory. The original model is
not replaced, and generated geometry must not increase. Error/topology can
prevent reduction: such variants are explicitly recorded with `reduced:false`,
not claimed as optimized. The optional tier is `standard` or `legendary`.
It does not compress or replace the supplied textures. Separate vertex buffers
preserve compatibility with the renderer's exact fitted-gear batching; the first
interleaved catalog reduced triangles but increased calls and was not integrated.

The [simplification documentation](https://gltf-transform.dev/modules/functions/functions/simplify)
explains why error/topology can stop reduction before the target ratio. Ratios
are not visual acceptance. Preserve all seams, body coverage, attachment and
animation behavior; inspect representative poses before any runtime integration.

```sh
EIDOLON_E2E_WEARABLE_PILOT_ROOT=/absolute/new/pilot-directory \
  npx --no-install playwright test tests/e2e/wearable-lod-pilot.spec.js
```

This optional test compares original-left/pilot-right High and Low fitted
Fighters with their full outfits. It substitutes only the pilot chest file in
the test page; no live source/catalog/server role is modified. The test skips
without an explicit generated artifact directory.

For all 252 delivered item/tier/class fits, create a new empty owned directory
and generate the catalog. Keep redirected logs outside the empty directory.

```sh
node scripts/derive-wearable-catalog.mjs /absolute/new/empty/catalog-directory
EIDOLON_E2E_WEARABLE_CATALOG_ROOT=/absolute/new/empty/catalog-directory \
  npx --no-install playwright test tests/e2e/authored-wearable-derivatives.spec.js
```

The 16 optional browser cases compare original-left/derived-right full outfits
on Fighter, Rogue, Wizard and Cleric in both tiers and both qualities. They check
source/output hashes, independent character rigs, all 14 fitted items, sampled
finite animated vertices, geometry reduction and no increase in draw calls,
and capture four pose comparisons. Those mechanical checks are not automatic
visual approval, every possible gear combination, a complete animation sweep,
or an equipped-world/party budget pass. No production catalog is substituted.

The equipped-world reference can separately be exercised with
`EIDOLON_E2E_RAISED_EQUIPMENT=1` and
`EIDOLON_E2E_RAISED_TERRAIN_PROFILE=1` on
`tests/e2e/world-elevation-preview.spec.js`. Its unchanged original limits
currently fail with delivered full-detail gear. A first chest pilot does not
resolve that full-outfit or party gate; qualify the remaining models and actual
integration before rerunning those impacted measurements.
