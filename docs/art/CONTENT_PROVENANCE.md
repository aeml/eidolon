# Supplied content provenance and notices

## Current catalog review — October 20, 2026

The [feature-freeze review](../plans/2026-10-20-feature-freeze-review.md)
pins the accepted Alpha 1.79.86 source/catalog, lockfiles, license/notice files
and the original Pages artifact receipt. Existing project code and asset
licenses are committed choices; earlier statements below about an unchosen
project license are historical. They do not require choosing those terms again.
Separately supplied inputs still retain their own notices and source questions.

The opt-in Meshy Fighter is also a shipped input, even though it is not the
default character. Its [manifest](../../assets/archetypes/Fighter/meshy-pilot-manifest.json)
records the provider, source hash, two derived model hashes, model/rig task IDs,
declared paid-API origin and provider ownership-document URL. This is recorded
provenance, not independent verification of the account/plan or source rights.
Retain that source-specific question in the final shipped-catalog review; do
not silently exclude the pilot from the catalog or label it CC0.

Remaining 1.86/1.90 work is to substantiate any unknown input permissions,
check matching editable/LFS source availability, and complete backend/build-tool
transitive notices and the exact final artifact's notices. The current review
does not relicense inputs or waive those requirements. The dated inventory below
remains useful provenance and is not a current declaration that already
published Credits or the existing project licenses are absent.

## Retained component inventory

This inventory records supplied notices retained from the accepted Alpha1.79.2
checkout and the current delivered runtime selection. It is not independent upstream legal verification, a complete license
review or permission to relicense supplied work. The repository's
[LICENSE](../../LICENSE) and [NOTICE](../../NOTICE) identify AGPL-3.0-only for
project-authored software, scripts and text. [ASSET-LICENSE](../../ASSET-LICENSE)
sets the separate terms for project-authored visual/audio assets and editable
art sources. These existing project terms do not establish rights in supplied
inputs; the final1.86/1.96 shipped-catalog rights review remains open.

| Shipped component | Supplied source/notice | Publication path and remaining scope |
| --- | --- | --- |
| Three.js0.181.2 | Installed package `node_modules/three/LICENSE` | `prepare-client.mjs` copies it unchanged to `vendor/three/LICENSE`; Pages includes `vendor/`. Covers the package notice, not Eidolon code/art |
| protobuf.js8.7.1 minimal runtime | Installed package `node_modules/protobufjs/LICENSE` | Same builder copies it to `vendor/protobuf/LICENSE`; no new dependency or substituted license text |
| meshoptimizer gameplay-geometry worker | Installed package `node_modules/meshoptimizer/LICENSE.md`; [published notice](../../assets/notices/meshoptimizer-LICENSE.txt) | The worker builder preserves the license in its generated output. This component notice does not license the game or its assets |
| Cinzel font | [source record](../../assets/fonts/SOURCE.txt), [OFL notice](../../assets/fonts/OFL.txt) | Both sit with the delivered font under `assets/fonts/`, included by the assets publisher |
| Fighter source components | [provenance](../../assets/archetypes/Fighter/PROVENANCE.md), [supplied MakeHuman notice](../../assets/archetypes/Fighter/LICENSE-MAKEHUMAN-CC0.txt) | Files included beside delivered class assets; provenance explicitly does not separately relicense project additions |
| Wizard source components | [provenance](../../assets/archetypes/Wizard/PROVENANCE.md), [supplied notice](../../assets/archetypes/Wizard/LICENSE-MAKEHUMAN-CC0.txt) | Same distinction between source components and project additions |
| Rogue source components | [provenance](../../assets/archetypes/Rogue/PROVENANCE.md), [supplied notice](../../assets/archetypes/Rogue/LICENSE-MAKEHUMAN-CC0.txt) | Preserve the actual source record, not an inferred whole-asset CC0 label |
| Cleric source components | [provenance](../../assets/archetypes/Cleric/PROVENANCE.md), [supplied notice](../../assets/archetypes/Cleric/LICENSE-MAKEHUMAN-CC0.txt) | Source notices do not license the game or all derived work |
| Ilyra appearance | [NPC source/readme](../../assets/npcs/ilyra/README.md) referencing Wizard notices | Dedicated project-authored outfit; keep inherited source references and resolve project-specific licensing with the owner |
|252 equipment GLBs and four weapon-motion banks | [delivery manifest](../../assets/equipment/authored/manifest.json), [equipment source guide](EQUIPMENT_ASSETS.md) | Exact hashes, authoring/source paths and binding instructions exist. These are provenance/integrity evidence, not a supplied project license or final fit/art approval |
| Twelve complete garment outfits / 96 GLBs | [garment source records](../../assets/garments/PROVENANCE.md), [output/input registry](../../src/assets/garments.generated.js), [generator](../../scripts/generate-garment-models.mjs) | Four supplied class fits at High/Low. Registry records 672 references to 168 fitted equipment inputs; source-component and project-specific rights retain their original scope |
| Six held garment designs / twelve GLBs | [held registry](../../src/assets/heldGarments.generated.js), [generator](../../scripts/generate-held-garments.mjs) | Sword, dagger, staff, mace, shield and tome; twelve recorded grip-coordinate/size references. These source records add no separate license grant |

The current character and wearable derivatives remain recorded in
`assets/archetypes/runtime-selection.json` and
`assets/equipment/runtime/manifest.json`; their original and retained variants
share the unresolved project-specific rights above. Matching derivative hashes
does not provide an additional license.

The asset generator's read-only check validates data coverage and bytes, not
redistribution rights. Known font/package/source notices can be preserved now;
unknown project rights must remain explicit rather than assigning MIT/CC0
without the owner. Backend/tool transitive dependency notices, other original
content and the final player-facing credits package still require review of the
actual release artifact at their roadmap gates.
