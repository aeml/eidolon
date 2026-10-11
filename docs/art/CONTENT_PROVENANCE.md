# Supplied content provenance and notices

This inventory records supplied notices retained from the accepted Alpha1.79.2
checkout and the current delivered runtime selection. It is not independent upstream legal verification, a complete license
review or permission to relicense project-specific work. There is no root
project-license file in this snapshot; the owner's project/art licensing choice
and the final1.86/1.96 notice review remain open.

| Shipped component | Supplied source/notice | Publication path and remaining scope |
| --- | --- | --- |
| Three.js0.181.2 | Installed package `node_modules/three/LICENSE` | `prepare-client.mjs` copies it unchanged to `vendor/three/LICENSE`; Pages includes `vendor/`. Covers the package notice, not Eidolon code/art |
| protobuf.js8.7.1 minimal runtime | Installed package `node_modules/protobufjs/LICENSE` | Same builder copies it to `vendor/protobuf/LICENSE`; no new dependency or substituted license text |
| Cinzel font | [source record](../../assets/fonts/SOURCE.txt), [OFL notice](../../assets/fonts/OFL.txt) | Both sit with the delivered font under `assets/fonts/`, included by the assets publisher |
| Fighter source components | [provenance](../../assets/archetypes/Fighter/PROVENANCE.md), [supplied MakeHuman notice](../../assets/archetypes/Fighter/LICENSE-MAKEHUMAN-CC0.txt) | Files included beside delivered class assets; provenance explicitly does not separately relicense project additions |
| Wizard source components | [provenance](../../assets/archetypes/Wizard/PROVENANCE.md), [supplied notice](../../assets/archetypes/Wizard/LICENSE-MAKEHUMAN-CC0.txt) | Same distinction between source components and project additions |
| Rogue source components | [provenance](../../assets/archetypes/Rogue/PROVENANCE.md), [supplied notice](../../assets/archetypes/Rogue/LICENSE-MAKEHUMAN-CC0.txt) | Preserve the actual source record, not an inferred whole-asset CC0 label |
| Cleric source components | [provenance](../../assets/archetypes/Cleric/PROVENANCE.md), [supplied notice](../../assets/archetypes/Cleric/LICENSE-MAKEHUMAN-CC0.txt) | Source notices do not license the game or all derived work |
| Ilyra appearance | [NPC source/readme](../../assets/npcs/ilyra/README.md) referencing Wizard notices | Dedicated project-authored outfit; keep inherited source references and resolve project-specific licensing with the owner |
|252 equipment GLBs and four weapon-motion banks | [delivery manifest](../../assets/equipment/authored/manifest.json), [equipment source guide](EQUIPMENT_ASSETS.md) | Exact hashes, authoring/source paths and binding instructions exist. These are provenance/integrity evidence, not a supplied project license or final fit/art approval |

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
