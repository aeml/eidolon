# Alpha 1.9.20 — the crystal holds its ground

Status: pushed to master as `f333c7610f5e5b9ccfb958735e01029a8747fc6f`;
CI run35481615306 is active, monitored by Luna `/root/watch_release_1_9_20`.
Server/Jest jobs passed and three browser-smoke shards were running at the last
authoritative check. Public delivery is not yet verified. Keep the full1.10
scope and accepted evidence.

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

Tidestar run `waterraid0920d` tested the preceding split-healer inputs using its
already-built image. It defeated the guardian with all five alive but failed
the no-damage-progress limit on a first-wave AquaGolem. Artifacts are preserved
in `/tmp/eidolon-water-raid-20260920-r4-noJI9r/`; this is not full acceptance or
a rendered test of the new origin correction. Next raid runs should use the
corrected runtime. No active test was restarted merely to include it.

## Next raid coverage

After this deployment and public identity verification, run Ember Crown (Fire)
with the existing five legal level70 builds, zero retries, normal readiness/
entry, full guardian combat, three waves/ordered vent channels, manual claims
and saved re-login. Use the shared tank/group healer assignments and bounded
approach trace (local follow-up8995b9ee). Do not overlap native deployment QA.

This changes the immediate validation order, not the required scope: Tidestar's
full repair/claims remain open and must be revisited, and Skyglass/other dungeon
families/the earned campaign remain required. Exercising the next untested
realm can reveal shared input or encounter problems without immediately
repeating the already-observed Water guardian. It does not turn Fire's prepared
prerequisites into earned Water completion. No gear/stat/damage/watchdog changes
are made to make the next realm pass.
