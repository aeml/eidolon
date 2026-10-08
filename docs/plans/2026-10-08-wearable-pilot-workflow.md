# Wearable runtime-copy pilot

This is staged1.87 work, not an active asset catalog or complete equipment pass.
Keep delivered fitted models and provenance untouched. Use the existing pinned
dependencies from `package.json`; the task can instead provide a separate
`EIDOLON_ASSET_TOOL_MODULES` directory containing those exact versions.

Create a new owned output directory, then run from the repository root:

```sh
node scripts/derive-wearable-pilot.mjs 'Plate Mail' Fighter /absolute/new/pilot-directory
```

The generator validates the delivered manifest hash, preserves exact rig and
node-transform contracts, derives High/Low files and rereads them. It refuses
existing output files or the original source directory. The original model is
not replaced, and generated geometry must decrease. It does not compress or
replace the supplied textures.

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

The equipped-world reference can separately be exercised with
`EIDOLON_E2E_RAISED_EQUIPMENT=1` and
`EIDOLON_E2E_RAISED_TERRAIN_PROFILE=1` on
`tests/e2e/world-elevation-preview.spec.js`. Its unchanged original limits
currently fail with delivered full-detail gear. A first chest pilot does not
resolve that full-outfit or party gate; qualify the remaining models and actual
integration before rerunning those impacted measurements.
