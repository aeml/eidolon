# Alpha1.79.82 preparation: outfitter poses, item inspection and dungeon stonework

This isolated candidate follows selected master17a5862eca203373d9e004d25fbbfb71f5d5458b.
It is prepared, not merged into master, pushed or deployed. Alpha1.79.81 must
complete its own CI/deployment/public acceptance first. This preparation does
not declare beta, feature freeze, final art or the full goal complete.

The player feature is Veyra's Pose/Moment appearance inspection, with stable
main/offhand strikes, supported states, held endpoints, comparison continuity,
loading/empty-selection cleanup and the Player Guide instruction. The existing
held-item/full-character switch is reused. A corrected sticky header also
covers scrolled catalogue text above the title. Gear, membership, price,
ownership, EP and gameplay combat rules remain the existing server rules.
The character portrait's centered garment row retains its behavior.
[Outfit component](2026-10-18-garment-pose-inspection.md).
[Held coverage and header correction](2026-10-18-held-garment-pose-qualification.md).

Item inspection now displays saved metadata, comparison hints and unknown gem
descriptions literally. Unknown inherited set/effect identifiers no longer
interrupt hover or deliberate inspection, and stat/socket totals retain own
numeric keys. Three runtime files and nine regressions exactly match qualified
component1aea5739a127bf05f1094c048c1a9ed5f6c1c2cc. Its63checks/eight suites,
original six failures and additional deliberate-inspection failure are retained
separately from the earlier784-check assembly. No saved data or server protocol
changes. This closes the demonstrated inspection bugs, not the wider F2 review.
[Item-text qualification](2026-10-18-inventory-tooltip-text-boundary.md).

Selected world art adds softly shaped wall piers and separates elemental wall
mineral albedo from colored room lighting. Four source files exactly match the
qualified2f9e3f783414017e7ef84eebee5fecd85f221796 component. Its73-file frozen
packet was revalidated in full; original34CPU/four native cases cover five
families in both qualities, actual movement/HUD, exact source restorations and
resource returns, unchanged submission counts and original scene/wall bounds.
No collider, room layout, floor, emission/relief/roughness, light, texture object,
material object or shader branch is added.
[Wall qualification](../art/2026-10-17-dungeon-wall-finish.md).

The scalar finite-box shadow check is also selected, byte-identical to2a061903a.
Its127CPU/four native component cases retain all34pose/lighting states, flags
and limits. This reduces temporary CPU allocations; it is not a whole-game FPS
or performance-budget claim.
[Shadow qualification](2026-10-18-shadow-finite-box-qualification.md).
No movement-audio code or rejected renderer experiment is included. The audio
integration's incomplete six-case gate and both prior input failures remain open.

Evidence and limits:

- Original outfit inspector:24native AMD/RADV cases,290static pose samples,
  retries0/skips0. Four matching class outfits and eight Fighter universal
  previews; this does not prove every universal on every class/all moving poses.
- Held extension:12CPU-only browser cases/292samples, fourteen prepared gear
  entries and matching outfits, retries0/skips0. Native validation remains open.
- Header correction: two reproduced failures, then two changed-source passes
  and48samples. CPU-only; latest native UI layout remains required.
- Existing four connected class wardrobe identities now include actual bundled
  pose-isolation checks. They are prepared/linted/enumerated, not yet executed.
- At8508787c6b0723f51c30594f3114f15c7109961b,784focused checks/21suites pass in
  141.28s, including all selected geometry/material/preview/wardrobe/ownership,
  privacy, enrollment, helper and release-presentation rules. A harmless local
  frozen-package naming warning is retained; the explicit21suite inputs passed.
  A local-only launcher subsequently enumerates those same21maintained suites
  while excluding frozen QA packages from module discovery; CI config is unchanged.
- Copied publication at8508787c6 builds successfully:520engine modules,
  4,914,689engine bytes, bundled styles/analytics and unchanged canonical worker
  SHA256 `28b738eaf5aa3a9ba5df513fbd8c400f3d82a5f0f2624d529731c57b80a95f03`.
  This predates the header correction and latest connected-test additions. Rebuild
  the exact final source before using it as an assembled/publication qualification.
  It also predates the selected item-inspection fixes and latest patch-note text.

The twelve synchronized release locations use1.79.82. There are517cumulative
notes, ten initially and51lazy pages; all516prior entry strings remain byte-exact,
serialized-array SHA256
`22814e2f6f4d6febd8e61cc67f94d3c7ae300b783e5295e221efad7370cbc5d0`.
After item-inspection selection and the added current-release bullet,
386release-presentation checks pass in3.08seconds; all516prior raw entry strings
were reread and remain exact. This is an incremental check, not another run of
the earlier784-check assembly.
Model assets, dependency versions, schema27 and stationary-action protocol
remain the selected81 inputs. No paid generation is performed. The original
qualified UI history is retained under
`refs/archive/20261018-garment-pose-qualification`.

Before publication, accept81, wait until all workflows are terminal before any
local GPU qualification, rebuild the final copied candidate, finish appropriate
assembled native gameplay/preview/connected checks and preserve original input/
performance findings. Then merge selected work into master, fetch/ordinarily
merge remote changes, push once and verify its own complete CI, deployment and
served assets. Do not silently accept the separate unexecuted legacy jump fix
or failed movement-audio source. Final world/art/all-motion/device/campaign,
security/operations, owner, beta and1.99requirements remain open. Human feedback
and soak/stress remain deferred, not passed; public admission is unchanged.
