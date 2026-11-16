# Browser source

`main.js` boots the client. `repro.js` and `animationGallery.js` serve the existing public art gallery. Add implementation under its owning area:

- `core/`: engine, rendering, geometry, networking, input, world and gameplay systems.
- `entities/`: actors, players, enemies, NPCs, effects and interactions.
- `skills/`: class abilities and shared presentation contracts.
- `ui/`: feature controllers and views; `styles/` owns CSS.
- `art/`: actors, animation, equipment, environments, effects and rendering helpers.
- `assets/`, `data/`, `audio/`, `analytics/`, `world/`, `utils/`, `proto/`: their named contracts and shared resources.

Some boot/login modules remain at stable paths in `core/` and `ui/`. They are shared by the public login graph or cached clients; moving them requires delivery and singleton verification. The geometry worker and `GameEngine.bundle.js` also have stable public URLs. Generated bundles and vendor files are publication outputs, not editable source.

Keep new features with their owner and put tests under the corresponding `tests/unit/` area. See [repository layout](../docs/development/repository-layout.md).
