# Alpha 1.9.20 — the crystal holds its ground

Status: implementation verified locally; version/login/cumulative patch notes
prepared while Tidestar continues with its already-built server image. Not
pushed or deployed yet. Wait for that run to finish before deployment, then use
Luna for CI monitoring. Keep the full1.10 scope and accepted evidence.

## Player-facing patch notes for the next release

- Crystal repair events now stay centered on the crystal in all four elemental
  raids. Defeating a guardian near a wall no longer shifts Maelin, ritual markers
  and surrounding enemy waves away from the crystal or outside the chamber.
- Three repair waves, each realm's ritual tasks, enemy strength, rewards and
  manual quest turn-ins are unchanged. The 15-minute dungeon logout rule is
  unchanged.

## Evidence and scope

The initial boss-death callback passed its death coordinates to
`StartCrystalRepair`, whereas the rendered crystal and resumed repair used the
last boss room's center. The repair worker now resolves that same fixed center
from the actual instance before acquiring `RepairMu`. The existing fallback
coordinates remain for synthetic instances without a boss-room layout.

`TestCrystalRepairStaysAtCrystalAfterGuardianDiesNearChamberEdge` failed on all
four realms before the correction (130-unit displaced origins). It now checks
Maelin and the ritual origin, marker footprints and three surrounding spawn
rings against the actual chamber floor. The existing live-worker lifecycle
fixture now places its player at the real crystal rather than world origin.

Focused repair, ritual, snapshot, resume and worker-shutdown tests pass in
2.797seconds; formatting and diff checks pass. This is targeted server evidence,
not a claim that all four raids or the earned campaign have been completed.

All269 version/history checks pass in2.966seconds; changed-test lint, Bash
syntax and diff checks pass. Login, package/lock, manifest, server/build/deploy
defaults and CI identities agree on1.9.20, with all prior patch notes retained.
README now points at the migrated domains and current31-chapter/admin/1.10
scope rather than describing a never-deployed1.0 candidate. Old file-size
measurements are explicitly historical rather than presented as current.

Tidestar run `waterraid0920d` is testing the preceding split-healer inputs using
its already-built image. Do not overwrite those artifacts or count its result
as a rendered test of this new origin correction. Next Fire/Air runs should
use the corrected runtime. No active test is restarted merely to include it.
