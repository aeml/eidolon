# Asset provenance

- MakeHuman Community MPFB data: https://github.com/makehumancommunity/mpfb2
- Source checkout: `437dd513888a92399d1d3200d2e80859fae55abc`.
- CC0 base mesh, human proportion/muscle targets, blink targets, game_engine rig and skin weights from `src/mpfb/data`.
- MakeHuman CC0 system assets pack: https://files2.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip
- Used from that pack: young light-skinned male skin map and eyebrow001. The experimental short04 hair asset is absent from the delivered character.
- Upstream licensing documentation: https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.md and https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html
- The upstream asset license is reproduced in `LICENSE-MAKEHUMAN-CC0.txt`; it applies to those source components. This is distinct from the GPL license of the MakeHuman/MPFB application code, which is not embedded in the character.
- Fighter reference images supplied/generated for this project informed the visual direction and build. The September 30 revision replaces the projected reference painting with the CC0 anatomical skin diffuse map, tinted and combined with procedural skin microstructure. Cloth, scalp microstructure, roughness and iris-fiber patterns are authored in Blender and UV-baked. The project-specific result is not separately relicensed by this notice.
- Viewer runtime: Three.js 0.181.2, MIT license, reproduced in `LICENSE-THREE.txt` and the bundled runtime's legal notices.

This asset is a new anatomical reconstruction. The previous v4 mesh and all intermediate Blender checkpoints are preserved separately in the workspace.
