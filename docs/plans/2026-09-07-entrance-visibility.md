# Entrance scenery — keep the local hero visible

Runtime `d8a5361`, based on the locally verified 1.0.45 candidate. This is a
presentation correction for the four overworld procedural dungeon entrances,
not a collision rewrite, general dungeon-wall transparency or phone sign-off.

## Cause and chosen treatment

Actual Shield gameplay showed the entrance facade obscuring the Wizard. The
Verdant roof can cover a hero at local (-36, 0, -30), outside its existing circular
interaction/collision footprint. A regression using the production entrance
proves that camera occlusion; legacy entrance dimensions remain unchanged.

`SceneryVisibility` samples feet, torso and head with the actual orthographic
camera rays at 10 Hz, with bounds culling, a short hold and smooth transitions.
Only tagged overworld entrance meshes participate. Private material clones open
a localized, feathered, screen-dithered foreground window around the rendered
hero. Geometry, camera framing, authoritative targeting and entry rules do not
change. The window preserves depth ordering and normal architecture/shadows
outside its small radius. Original materials return when the view clears;
scene cleanup disposes only the private clones, not cached/shared materials.

## Retained experiments and evidence

Initial whole-landmark alpha fading (`3820f6e`) reduced hero contrast: the improved
GPU reference checks failed all ten cases, recovering only 10–23 of 57 desktop
reference pixels and 17/74 or 18/76 phone pixels. Log:
`/tmp/eidolon-entrance-visibility-reference.log`. A simple visibility threshold
was inadequate, so it was replaced by comparison against the same unobstructed
hero with physical lighting/shadows retained.

Localized alpha blending recovered the hero but inspected captures exposed
incorrect depth ordering elsewhere on the roof. That intermediate result was
rejected. Final dither-discard preserves opaque material depth behavior; ten GPU
checks pass **50.4s**, covering all four entrance families at High/Low desktop
quality plus Verdant portrait/landscape. Recovered hero pixels match their
unobstructed reference; changed pixels outside the bounded window are **zero**.
Log: `/tmp/eidolon-entrance-dither-browser.log`. Inspected Verdant captures retain
the roof while revealing the Wizard through a small grain-feathered window.

Final runtime client checks pass **215 suites / 3,183 tests / 129.07s** and lint.
Focused controller/resource-ownership checks pass **14 / 1.023s**. Logs:
`/tmp/eidolon-entrance-cutaway-full-client.log`,
`/tmp/eidolon-entrance-cutaway-final-lint.log`,
`/tmp/eidolon-entrance-dither-unit.log`.

The actual isolated-server `entrance-visibility` route passes **47.7s / 50.0s
total**. It uses ordinary movement to the existing Verdant waypoint, observes
the production cutaway, buys/saves/casts Shield through normal interfaces,
verifies a real hostile hit and recalls to town. Capacities remain **695 / 834 /
834**, with **310 absorbed / 524 left** and real expiry. Town return restores
the original material identities. Credential scan finds zero artifacts to
sanitize and disposable service/data cleanup succeeds. Log:
`/tmp/eidolon-entrance-cutaway-gameplay.log`. The actual landscape capture was
inspected: the hero is visible through the facade, with controls and chat intact.

## Alpha 1.0.46 package

Package **`2fe9cb2`** adds distinct **a window through the stone** patch notes and
synchronized version defaults. The ten rendered checks join anonymous CI; the actual
cutaway/return route joins full predeployment character QA using a separate
allowlisted disposable character. Prior 45 runtime-readiness ancestry is merged.
Final package verification passes **236 contracts / 1.788s**, **215 suites /
3,185 client tests / 126.31s**, lint, backend-root race **12.231s**, and all
**75 anonymous browser checks / 8.2m**. Gameplay-server runtime is unchanged
from the previously race-tested 45 ancestry. The final versioned actual route
passes **41.5s / 42.9s total**, repeating **695 / 834 / 834**, expiry, **310
absorbed / 524 left**, cutaway and original-material town restoration. Scan
and disposable cleanup pass. The final actual landscape image is inspected:
the Wizard is visible through the small window, with nearby enemies, controls
and chat still rendered. All owned local test handles are terminal success.

Logs: `/tmp/eidolon-release46-contracts.log`, `/tmp/eidolon-release46-client.log`,
`/tmp/eidolon-release46-lint.log`, `/tmp/eidolon-release46-root-server.log`,
`/tmp/eidolon-release46-anonymous.log`, `/tmp/eidolon-release46-gameplay.log`.
This locally verified package is ready for root integration. Publication must
follow successful sequential CI/live gates for every earlier queued version;
local package verification is not deployment evidence.

Physical-phone performance, other world scenery, wider enemy visibility and
the broader collision/playability audit remain open. This localized cutaway is
not proof those gates are complete.
