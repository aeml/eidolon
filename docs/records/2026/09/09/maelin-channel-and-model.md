# Maelin's artificer model and ritual loop

Status: later story candidate only, excluded from Alpha1.0.58. Implemented with
focused and rendered proof; full regression for this latest change is pending.
No production or earned full-raid acceptance is claimed.

## Reproduction and implementation

A read-only actual CrystalKeeper remote tick in stateCHANNELING requestedIdle:
`/tmp/eidolon-maelin-channel-source-probe.log`. Actor's remote fallback did not
know about ritual channeling. The temporary Maelin actor also used the ordinary
player Wizard mesh. Red `/tmp/eidolon-maelin-channel-before.log` reproduced the
missing dedicated mesh/Channel clip and channel dispatch before implementation.

c60d374 gives Maelin a dedicated pooled CrystalKeeper model/recipe. It reuses the
established adult NPC rig and geometry/material caches, but has an open face,
braided hair, forehead lenses, tailored work coat/apron, toolkit, four elemental
vials and a tuning fork. It does not alter any of the four town-service models,
the player Wizard, or true AvengingSeraph summons. No quest marker, reward handler,
player skill implementation or summon lifetime is inherited.

The model has Idle and loopingChannel clips. Only CrystalKeeper overrides the
remote resting-animation hook; normal actors keep their existing Idle fallback.
CHANNELING selectsChannel only after its clip is loaded; IDLE returns toIdle.
Server-owned state, not a transient ritual message, controls the selection.
Mesh-pool reset restores the original pose. The server now faces Maelin toward
the reliquary behind the chamber center; no client-position/rotation override.

`test:e2e:crystal-art` runs the eight sanctum cases and two closeup comparisons.
The later release's anonymous browser shard2 now includes this command. Each
sanctum fixture also runs Maelin's actual actor update in the matching state.
The closeup reference explicitly uses the prior Wizard mesh; it is not a live
NPC substitution or a claim that the old release has the new behavior.

## Verification

-72187focusedPASS35tests/3suites/1.02s plus lint. Actual clip motion and pool
  reset, channel dispatch, real summon identity and existing town actors.
  `/tmp/eidolon-maelin-channel-{after,lint}.log`.
-1819server racePASS5.024s, including real Vigil spawn/facing and snapshot/resume
  regressions. `/tmp/eidolon-maelin-facing-server.log`.
-77351hardware browser PASS10cases/30.3s onc60d374. Archive
  `/tmp/eidolon-maelin-artificer-proof-hbZO36`,scan0; log
  `/tmp/eidolon-maelin-artificer-browser.log`. Inspected desktop/portraitHigh
  channeling and desktopLowreturnedIdle comparison captures. The new adult
  workwear silhouette and raised hands differ from the ordinary mage reference.
-67581additional actual mesh-load test initially failed because the unit canvas
  lackedmeasureText, before the mixer loaded. Only its name-tag paint endpoint
  was stubbed; actual mesh/mixer/update remain intact, and browser tests render
  real name tags. The failed log remains
  `/tmp/eidolon-maelin-channel-complete-focused.log`.
-08923bbadds that late-mesh regression:36tests/3suites/0.955s plus lint passed.
  Logs `/tmp/eidolon-maelin-channel-complete-{focused-r2,lint-r2}.log`.
-33566CI-mode bundled Chromium PASS10cases/52.0s, retries0. Archive
  `/tmp/eidolon-maelin-ci-proof-vMum07`,scan0/port41961cleanup verified; log
  `/tmp/eidolon-maelin-artificer-ci-browser.log`.

The previous full primary regression onaa4f0f1 predates this model, actor hook and
server-facing change. The required fresh full regression28798 on frozen117fffe
is now TERMINAL0/PASS:273client suites3912tests87.23s plus lint, full Go-race
root18.393s/game224.339s/database1.086s. Logs
`/tmp/eidolon-primary-maelin-final-{client,lint,server}.log`.
Actual group combat, durable reconnect transport and story pacing remain separate,
incomplete acceptance gates. This is local verification, not published story art.

## Planned patch notes

Maelin now appears as a field artificer with her own workwear and repair tools.
She faces the crystal and visibly channels throughout the repair Vigil, including
when her model loads after the ritual has begun, then lowers her hands when the
repair finishes. Spirit Guardians keep their separate angel appearance.

Include with the eventual accepted story release, not the recovery-only1.0.58.
