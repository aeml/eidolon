# Alpha 1.0.62 — adventure together

Published and live-verified September11 at20:32 UTC as
0231c9488998432bdbcfcac6cc2a049cea0e9b1b. Based on the integrated successor31501ede with
the user's website and game-analytics commits throughdea1795b preserved. The
full1.1–1.10 roadmap remains required; this is an incremental repair release.

## Player-facing scope

- Whole-instance dungeon/raid party kill credit, including connected downed
  teammates;110-unit overworld reward range and kill-time recipient snapshots.
  Each player still performs their own quest turn-in.
- Enemy stun/root/slow lifecycle, attack-impact stun admission and replicated
  status fields for observers. Boss immunity is retained.
- Compact desktop party/healing roster and explicit support-target admission;
  phone party reward guidance and move-only input consistency.
- Forge/item detail refresh, socket color consistency across icons/equipped
  models, held-weapon clearance and shared Well Rested aura rendering resources.
- Trained Guardian Roar/Executioner Spin areas and Purifying Wave cleansing-area
  Mastery; ready Chronicle guidance and empty fresh-character stashes.
- Prepared character stats now match ordinary creation/growth. Existing saves,
  ordinary base stats, outside regeneration and town recovery are not rewritten.

All older patch-note entries, including the domain61 migration, are retained.
Login, packages/lockfile, release manifest, server/container/deploy/CI and
disposable-QA defaults advance together to Alpha1.0.62.

## Explicit exclusions

The expanded campaign/reward curve/Dark King phase-cap changes, later Fighter
duration/rune/offline parity work, unified ability/projectile/periodic receiving
defenses, explosive shield PvP/wall repair and wound PvP-budget/Magma repairs
remain in separate follow-up branches. Do not list those as shipped in62 or
mistake this incremental release for the complete1.1 dungeon/combat gate.
Four-player full dungeon clear, saved-build/class/talent acceptance and physical
phone checks remain open in the overall roadmap. Casino stages are unchanged.

## Verification and release gates

Earlier8cf72eb2 full client/server/lint acceptance is recorded in
[the integration history](2026-09-11-gameplay-after61-integration.md).
It does not establish full acceptance of this versioned candidate or the user's
subsequent analytics addition.51165 current focused PASS280tests/4suites1.695s
checks version/default/history consistency, analytics, disposable-QA defaults
and the complete declared browser partition; log
`/tmp/eidolon-release62-focused.log`. Discovery/plan coverage is not native play.

Before publication:

1. Freeze a clean versioned candidate and pass full client/lint/server checks.
2. Pass its declared browser partition and required native character, equipment,
   party/support, socket appearance and rest-render routes. Retain truthful
   source identity, ordinary input and sanitized evidence; do not replace a
   failed native route with a unit pass or prepared fixture claim.
3. Recheck remote master to preserve newer user changes; revalidate any resulting
   integration. Do not overwrite the user's website or analytics commits.
4. Publish through normal CI and verify matching client/backend identities,
   saved-character gameplay, four-class/remote animation and town-rest behavior
   on play.eidolonrealms.com/server.eidolonrealms.com.

The currently running4ed50046 CI and pendingdea1795b CI are separate sources.
Keep their GPU slot free; their eventual success cannot prove62 gameplay.
The user cancelled only the interrupted soak. Leave it stopped without treating
that cancellation as a waiver of ordinary release or future concurrency gates.

## Full local acceptance and CI submission

56004 completed with exit0 on unchangedeb091cda5058974054d75df9b9d4e64f75610c79:
full client283suites/3985tests139.757s, full lint, and all-package Go race pass.
Root server ran19.639s; game/loadtest/database/lifecycle results were valid Go
cache successes for their unchanged source, not new elapsed-time measurements.
Logs `/tmp/eidolon-release62-full-{client,lint,server}.log`.

24063 current-source partition verification passed:104 required browser cases,
no omissions or duplicates across12 stages/3 shards. This is discovery coverage,
not browser gameplay. Log `/tmp/eidolon-release62-partition.log`.

Remaining browser/native checks will execute in the normal CI release pipeline,
not compete with that runner through a second local Chrome instance. Source
submission to master is not a gameplay-deployment acceptance claim. Reviewed
workflow dependencies require all hosted tests and browser shards, then native
gallery, Well Rested render/GPU lifecycle and full disposable character route,
then production QA-input validation BEFORE either server or Pages deployment.
The default disposable route includes all-class initial stats, party/support,
equipment recovery, Forge/socket appearance and town-rest gameplay. Final live
saved-character/four-class/rest checks follow both deployments. None is bypassed.

Remote master was rechecked asdea1795b immediately before submission preparation;
it is an ancestor of the candidate. Root execution-ledger content is unchanged
from remote and is not part of this push. Any intervening remote move must be
handled by a fresh safe integration, never force-pushed over user changes.

## Published and accepted — September11,20:32 UTC

[CI34637129931](https://github.com/aeml/eidolon/actions/runs/34637129931)
finished SUCCESS on0231c9488998432bdbcfcac6cc2a049cea0e9b1b. Hosted client/server,
all three browser shards, predeploy character103394045529, production QA-input
validation, BOTH Pages/SSH deployments and final live103408203727 passed.
Final live step inspection confirms successful matching-release, anonymous/
persistent-character, four-class/remote-animation, town recovery/Well Rested,
sanitization and upload steps. No cancellation, skipped gate or substitute run.

Independent no-cache checks after completion return Alpha1.0.62 and the same
0231c948 commit from both `https://play.eidolonrealms.com/release.json` and
`https://server.eidolonrealms.com/healthz`; backend status is ok. The workflow
also checked the runtime main.js release query, not only manifest metadata.

Live artifact10281596463 is retained as
`live-browser-evidence-0231c9488998432bdbcfcac6cc2a049cea0e9b1b` (9,436,423 bytes);
predeploy artifact10280418987 contains16,472,835 bytes. Live evidence downloaded
read-only to `/tmp/eidolon-62-live-evidence-YVhNaQ`. The archived town screenshot
was visually inspected: full HP/MP, active aura and story-wizard guidance are
visible. Sanitization does not imply screenshot pixels were redacted.

The HTML report is only the last multiplayer invocation:1 expected,0 unexpected,
0 flaky,0 skipped. Do not describe it as the complete live suite report. Earlier
checks are evidenced by the successful individual CI steps and their console
summaries; anonymous/persistent reports8passed, town recovery reports2passed
plus1passed. Retaining every invocation's report is a future evidence-quality
improvement, not a claim that this single HTML contains every test.

This completes62's declared incremental release gates only. Expanded campaign,
later combat/talent/duration/recipient/Renewal repairs remain unpublished, and
full four-role dungeon/earned pacing/save/build/physical-phone/1.1–1.10 gates
remain required. No new source push accompanies this acceptance record. The
soak stays cancelled.
