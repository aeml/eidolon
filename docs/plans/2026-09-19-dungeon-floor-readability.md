# Dungeon floor readability — candidate, not deployed

The interrupted Tidestar guardian screenshot at
`/tmp/eidolon-water-raid-20260919-ZLnP7l/browser-results/five-player-raid-five-gear-a3cba--three-crystal-repair-waves/party-boss-TideboundTyrant.png`
was visually inspected. Its repeating cyan dots and tide lines dominate the
floor around small party silhouettes. Source inspection identifies the dots as
authored modular pearl samples, not evidence of duplicate floor geometry.

## Candidate change

- Floor texture repeats span24 world units instead of12, preserving wall scale.
- Linear magnification replaces nearest-neighbor sampling; mipmaps remain.
- Drowned floor pearls are removed, while wall pearls retain their bright theme.
  Floor tide lines become subdued engravings with a periodic horizontal curve.
- Geometry, collisions, room/raid mechanics, telegraphs, texture dimensions and
  resource counts remain unchanged. No additional draw calls or assets.

Developed in `/tmp/eidolon-floor-polish-GTaEiw`, branch
`work/dungeon-floor-polish-20260919`, while the main checkout's detached Tidestar
run continues on its original source. Do not merge into that checkout mid-run.

Six focused checks first failed on the old scale/filter/emission. After the
change,39 tests across procedural interiors and crystal sanctums pass, with
changed-file lint and diff checks. These establish data/resource invariants,
not subjective visual quality. No GPU workload was launched alongside the raid.

## Before publication

Inspect the candidate at High and Low after the raid releases the GPU, using the
existing interior gallery and a representative gameplay camera. Keep a before/
after comparison; ensure stone joints remain readable and attack warnings retain
contrast. The old gallery's detail-geometry assertion was8; it is corrected to9.
`src/repro.js` reads the same kit's metrics directly, and `createShapes()` now
includes the ninth `vigilInlay` geometry. Existing unit coverage confirms9; lint
passes for the gallery correction. No rendered check was removed. Only then
integrate, add accurate cumulative
patch notes and synchronized release versions, and deploy with the authorized
Luna watcher. This candidate is not a shipped fix or a full visual acceptance.
