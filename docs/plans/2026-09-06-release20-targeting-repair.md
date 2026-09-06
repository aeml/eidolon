# Alpha 1.0.20 live-QA targeting repair

The original 1.0.20 commit `bd54b2aab3b56aa6c83efe40d6071e3881ba6074`
passed predeploy checks and both deployment jobs, but CI `34028688737` ended
with a failed live multiplayer check. It is **not a fully verified release**.
Do not publish 1.0.21 ahead of a corrected 1.0.20's complete gate.

## Confirmed failure and correction

Both attempts recorded a living Skeleton under the pointer and nearer to the
camera than overlapping loot, while `hoveredEntity` was a LootDrop. The normal
input therefore requested pickup instead of the attack the remote observer was
waiting for. Inspection confirmed `getRaycastEntityPriority` always ranked loot
ahead of hostiles. This is a gameplay targeting defect, not only an observer
timeout or grounds for weakening the remote-attack assertion.

Living hostile hits now take priority over overlapping drops for both desktop
attack clicks and deliberate phone selection. Isolated loot remains clickable;
after the enemy dies, the same pointer can select the drop. Phone Use and auto-loot
retain their independent pickup behavior. No range, line-of-sight, reward or
damage rule changed. The correction is included in 1.0.20's own patch notes.

## Evidence

- New desktop and phone tests reproduced the failure before the change: two
  failures, five existing checks passing. They use real Three ray intersections
  with overlapping hitboxes, then the production primary-click handler; both
  now pass, including phone selection without auto-attack and loot after death.
- The complete 1.0.20 client suite passes **161 suites / 2,338 tests in 53.367
  seconds**, plus lint. Server code is unchanged from its passing deployment.
- The corrected disposable two-account route passes in **1.9 minutes**, including
  shared-hostile acquisition, remote attacks/abilities, remote Spirit Guardians
  lifecycle and three member-specific dungeon recall/resume cycles. Credential
  scanning and disposable cleanup passed. This complements, not replaces, the
  deterministic overlap regressions or required post-deploy live repeat.
- All **21 anonymous browser cases passed in 1.5 minutes**. These include the
  existing phone layouts and targeting presentation, not physical-device proof.

Logs: `/tmp/eidolon-1-0-20-live-failure.log` and
`/tmp/eidolon-release20-targeting-{red,green,client,lint,multiplayer,anonymous}.log`.
The original Cleric animation run also recorded a no-visible-hostile acquisition
failure before passing on retry. Its cause is not established as the same issue;
retain that evidence rather than describing the whole original job as clean.

Publish this correction as a successor commit of the failed 1.0.20 candidate,
keeping the 1.0.20 version identity until it passes its full gate. Carry that
commit into 1.0.21, then into each later queued version through fast-forwardable
ancestry. No force-push, skipped version or passing claim for the old CI run.
