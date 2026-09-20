# Tidestar formation approach — QA-driver correction

`waterraid0919d` failed after26.2minutes, zero retries, source6425b440. All five
legal prepared L70 members stayed alive. The guardian was defeated and the first
repair wave began; five of its six enemies died. The remaining AquaGolem was
about80units from the tank, whose approach planner returned no walking step.
The60second no-damage watchdog correctly failed. No full-clear, repair, manual
reward or saved-relogin acceptance is claimed.

## Evidence and correction

The private checkpoint was restored into a newly owned network-isolated Mongo
container solely to query the five saved classes/positions. No game server was
started, no timestamps changed and no production database accessed. The copy
was then stopped/removed; the original archive is retained.

Those exact positions reproduce a defect in the QA-only
`dungeonOccludedTargetStep`: its direct, lateral and backward probes are covered
by the four followers, despite a clear short diagonal walking path. The new
regression fails against the old helper. Four additional3.5unit diagonal probes
pass through the same full-segment body, wall and encounter checks. No actor
collision, enemy behavior, player stat, damage threshold or gameplay code changed.
The existing genuinely boxed-in and blocked-floor cases remain rejected.

All68 target-approach/party-control tests pass in0.855seconds; changed-file lint
and diff checks pass. This proves the recorded planner failure is fixed, not
that the whole raid is complete. Future full result attachments also include
the existing whitelisted spatial/room snapshot, avoiding a database restore
merely to recover final party coordinates. Console summaries stay compact.

## Retained artifacts

`/tmp/eidolon-water-raid-20260919-r4-px8cAd/`: log, copied `test-results/` and
`playwright-report/`. The HTML report's embedded JSON includes complete named
party result/healer attachments; inspect selected fields rather than dumping
the full combat histories. Credential scan passed. Owned run containers have
been removed.

Private save: `/tmp/eidolon-party-checkpoint-waterraid0919d-oeZWOM/save.archive.gz`.
SHA256: `bb8700d033136c09d6cbb7cc0a40491de9fb1bd2b7fa9ed361654c9c55b03e85`.
Do not publish this archive, alter its logout times or bypass the15minute rule.

## Next run

`waterraid0920a` is active after the specific reproduced correction, source
33ada570, detached launcherPID1277137 confirmed live. Same five legal L70
roles/gear, Low graphics and unchanged full repair/claim/re-login requirements;
zero retries. Launcher/log `/tmp/eidolon-water-raid-20260920-r1-iiKq4l/`.
Ports18285/18286/4187 were free before launch. Luna
`/root/watch_tidestar_0920a` owns read-only completion/failure monitoring.
Do not overlap browser/deployment work, edit the running route or poll previous
terminal handles. Preserve report attachments before any new Playwright run.
No result yet; this does not mark Tidestar complete.

Later result: `waterraid0920a` terminated after5.6minutes on a different optional
spacing failure: a FrostGuardian moved into the Wizard's planned path. This
does not establish another cardinal-probe failure or a completed raid. Its
[recorded interruption and narrowly verified replanning change](2026-09-20-raid-spacing-interruption.md)
retain the original movement and encounter assertions. The previous launcher
and Luna watcher are terminal; do not resume them.
