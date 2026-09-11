# Full roadmap integration after the62 release baseline

Unpublished development source for the full1.1–1.10 goal. This is not the
narrow62 release submitted to CI and is not ready to deploy. The source label
inherits62 only as the current baseline; its extra work needs its own later
version and patch notes after acceptance.

## Integrated sources

Started fromf196bfb4, the full accepted wound-budget server stage on the broader
campaign/Fighter/receiving-defense branch. Content comparison showed this branch
did not contain all later primary root/slow replication tests despite carrying
most of the runtime. Mergedf4f0723d to restore those checks and runner-queue
history as a5171c4d, then the user's remote throughdea1795b as89944c5e.

After62 source0231c948 was submitted to normal CI, carried that complete release
baseline as8408501676159335b9f7a99d7f02be37c0c02edd. This retains current domain
defaults, website/game analytics, historical patch notes and every62 fix.
The root execution ledger is not part of this branch's deployment workflow.

Merge conflicts were reviewed individually:

- Retain the tested `resolveAbilityEffectDuration` path for Unbreakable Grip's
  slow instead of restoring the old flat five-second timer. Receiving-defense
  routing remains in use; normal stat recalculation follows the slow.
- Preserve both the historical stun acceptance record and later Fighter
  diagnostic coverage instead of dropping either side's evidence.
- Keep Docker release arguments after dependency setup to preserve cache
  behavior, while updating their single version default to the current62 label.
  Do not add an earlier duplicate argument that leaves an old version below it.

## Evidence and next gates

On89944c5e,19342 focused Go race passed root1.048s/game6.366s for protobuf
root/slow replication, paid root/slow lifecycle, Fighter effect deadlines,
raw-wound PvP budgets, Magma walls and the lethal basic shield chain.
62082 focused client passed335tests/6suites3.434s: version/default alignment,
analytics, runner queues, attached status effects, Fighter durations and offline
Shield Slam runes. Logs `/tmp/eidolon-primary-merged-focused-{server,client}.log`.
Those are pre-84085016 focused checks, not full integrated acceptance.

Locked dependencies matched the tested62 dependency tree (only package version
metadata differed before the62 merge). Shared node_modules and generated,
ignored vendor assets were prepared for this new worktree. No actual browser
run has started and no physical-phone evidence is claimed.

Next: freeze current source and pass full client/lint/server checks. Then use
the actual `party-dungeon` route on isolated services when the designated GPU
slot is free. It launches four real browser-controlled roles (Fighter tank,
Cleric healer, Wizard/Rogue DPS) with explicitly prepared level30/common gear
and story gate, not claimed earned progression. Require the entire Normal
Verdant clear, real tank/heal/DPS participation, normal town recovery/resume,
individual Ilyra turn-ins, Water offers and fresh-logins preserving each reward.
Keep the existing bounded expedition/fight/route controls; do not enlarge them
merely to hide a navigation or combat failure. The prior Warden-only/route-timeout
run remains incomplete evidence.

Full talent/status outgoing/duration/offline audits, earned pacing and story,
saved-build and class checks, physical phones, later versions and the casino
remain required. Merging accepted pieces is not itself proof they work together.
The user cancelled only the interrupted soak; do not restart it or compete with
active release CI for the GPU. Continue substantive non-GPU work while queued.
