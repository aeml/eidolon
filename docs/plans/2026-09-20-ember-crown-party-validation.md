# Ember Crown prepared-party validation — September20

## Follow-up terminal — Magma Golem damage stall

`fireraid0920f` ended exit1 after8.0m on clean127e39d6, native34554, with the
settled-member reservation below. Luna's terminal report, parent exit and
`RAID_PROCESS_EXIT=1` agree. Launcher/log and copied reports/results:
`/tmp/eidolon-fire-raid-20260920-r6-BnDcKk/`. Owned containers are gone.
It passed the earlier formation point, then stopped on “No damage progress
against MagmaGolem for60seconds.” No full raid or runner-healer repair acceptance
is claimed. Diagnose the retained targeting/failure scene before another run;
do not weaken the damage watchdog or label the stall a balance failure.
Private save: `/tmp/eidolon-party-checkpoint-fireraid0920f-LxxNAq/save.archive.gz`.

Inspected retained Fighter receipt and failure screenshot: target health stalled
at1216, remained active/hostile/in the active cache, with visible mesh and correct
hitbox owner. Final logical distance3.019 was inside reported basic range4.
Other nearby hostiles were roughly10–12units away. The final pointer hit stack
was empty, but it was sampled after a ground sidestep, not during acquisition;
it does not prove a missing proxy. Recorded sidesteps moved successfully. The
scene shows overlapping party presentation and nearby Behemoth warning rings.
Do not infer insufficient gear, body collision or a server damage defect.
Exact acquisition-time hit stacks/rendered transforms were not retained, so
the cause remains unresolved. No speculative gameplay targeting change or
blind rerun is justified by the current evidence.

Bounded follow-up: the four recorded hostile positions, actual procedural
Magma Golem/Infernal Behemoth interaction boxes and the isometric camera direction
acquire the intended Golem on the first ray in a31ms geometry check. This rules
out static overlap for that reconstruction, not moving actors, rendered-transform
drift, camera motion or the original live scene. The Fighter receipt also has
successful early target hovers, while later Wizard/Rogue samples frequently
fail to hover; no death or gear failure is implied.

The existing per-sample hover read now retains its latest failed target ray,
hit IDs, logical/mesh positions, exact proxy matrix/bounds and frame state in
the bounded party receipt. It adds no browser round trips, polling, forced raycast
or input behavior changes. Unlike the final snapshot after a sidestep, this
captures the acquisition moment. Nine focused targeting/retention/recorded-scene
tests pass in1.02s; lint/diff pass. This is diagnostic preparation only; keep
Water continuation next after1.9.22 deployment rather than immediately replaying
the full Fire raid without a proved gameplay correction.

## Latest terminal run — settled teammate collision

`fireraid0920e` ended exit1 after4.1m on clean7fa57f00, native35409.
`RAID_PROCESS_EXIT=1` and preserved reports/results confirm termination; owned
containers are gone. Directory: `/tmp/eidolon-fire-raid-20260920-r5-JhyVd6/`.
The Rogue's accepted move-only click planned a2.04unit segment but stopped after
0.966units, with one blocked stop. Its destination was inside the first Cleric's
collision circle. The Cleric had completed the previous movement batch and was
already in formation, so the concurrent-lane reservation omitted that player.
The per-browser planner's earlier body snapshot was not retained; replication
lag explains the unsafe plan but is not directly proven by the trace.

The formation scheduler now checks every proposed segment against the existing
shared read of each player's own position, including members with no planned
move. Unsafe proposals replan within the original15second deadline; accepted
input failures still abort. A regression using these exact Fire coordinates
fails before the guard and passes after, reaching the unchanged five-unit
formation bound without issuing the unsafe segment. All62 formation/input
checks pass in0.635s; lint/diff pass. No gameplay collision, stats, movement
tolerance or watchdog changes. Full Fire acceptance and connected confirmation
of the proactive runner-healer escort remain open.

Private failed-run save, not a verified raid resume:
`/tmp/eidolon-party-checkpoint-fireraid0920e-cskwI5/save.archive.gz`.

### Previous run — runner healing range

`fireraid0920d` is terminal exit1 after33.7minutes on clean82472be7.
Native79539 and `RAID_PROCESS_EXIT=1` confirm Luna's report; artifacts are
preserved under `/tmp/eidolon-fire-raid-20260920-r4-8FyL2K/`. Owned services are
gone. All assault rooms and Ashen Imperator cleared; repair wave1 cleared and
wave2 started. The Rogue then died; no full repair or manual claim is accepted.
The other four survived. Both Clerics healed (37,954 and62,304 effective ally HP).
The Rogue's final incoming hits were ordinary Infernal Behemoth/Magma Golem
attacks, not an unresolved boss telegraph.

Retained healer decisions show the ritual runner moving57–81units away while
direct healing range is15. The second healer only approached once the runner
was injured; its no-injury fallback followed the tank. A detached correction
assigns the second healer to escort the active ritual runner proactively, while
the first remains tank-anchored. Personal marker assignments still control the
runner, with ordinary movement/roster/hotbar inputs and unchanged cast ranges,
combat stats and survival requirements.50 focused ritual/healing tests pass
in2.771s; lint/diff checks pass. This is not connected proof of a full Fire clear.
Keep this correction outside the active earned-party run until it ends.

Private failed-run checkpoint, not a successful raid resume:
`/tmp/eidolon-party-checkpoint-fireraid0920d-F7Afev/save.archive.gz`, SHA256
`c8793ebe2250c4ae4c97348c60aa49c8ce0cb3693a4fb0a2fc5b0b03900a24e8`.

### Previous run — observed-death retention

`fireraid0920c` is terminal exit1 after 8.5 minutes on clean `b62ad5eb`.
Parent session87777 and `RAID_PROCESS_EXIT=1` confirm Luna's terminal report.
Reports/results are retained in `/tmp/eidolon-fire-raid-20260920-r3-ad8SIz/`;
owned API/Mongo containers are gone. All five characters survived. The first
assault room cleared and combat advanced through several Infernal Behemoths in
the elite room; the final observed target went from13,650HP to318HP, then was
absent when the driver's next observation ran. The elite room remained uncleared
and the final guardian room unexplored. This was an assault creature, not the
raid guardian; no guardian, repair or full-clear acceptance is claimed.

The existing driver only sampled target life after awaited support/movement
work. It discarded an intervening death once the client removed the corpse.
`8c57dd8b` now retains deaths actually observed after normal world-message
application, scoped to exact actor and instance; a living same-ID actor clears
the record. Disappearance alone still fails. Four focused regressions plus nine
existing route checks pass (1.062s), with lint/diff checks. This proves the
observation correction, not that the lost Behemoth necessarily died or that the
full raid passes. No stats, combat rules or watchdogs changed. The next Fire run
must still complete the original full route. Private checkpoint:
`/tmp/eidolon-party-checkpoint-fireraid0920c-E88KM3/save.archive.gz`.

### Previous run — formation correction

`fireraid0920b` is terminal exit1 after5.3minutes, not accepted. Persistent
exec33534 returned exit1, matching Luna's final report and `RAID_PROCESS_EXIT=1`.
Both owned containers are gone; reports/results were copied to the run directory.
Log/launcher directory:
`/tmp/eidolon-fire-raid-20260920-r2-XJQrvW/`. Its exact-release guard observed
CI35483868157 success before beginning at02:44:44UTC on source
`a5599c748f5b315b60b354336535e4d5f0c8c430`. Public1.9.21 checks were already
accepted; no overlapping native deployment QA. Same five level70 legal geared
roles, tank/group healer split, zero retries, unchanged watchdogs and complete
assault/guardian/three-wave repair/manual-claim/relogin requirements. The sole
input correction was the exposed-corner search proven below. Do not restart on
observation expiry.

An initial watcher termination report was incorrect: parent re-polled33534 and
confirmed it live, with launcher PID2589890, both exact owned containers up,
and the log advancing through second-Cleric preparation. Only the watcher was
resumed, not the run. Cross-agent handle visibility or a missing log footer is
not terminal evidence; require the actual exit status/marker.

The run defeated first-room enemies, then failed the15-second gathering bound
before the next pull. The Rogue stayed at100016.0224/19782.6173 while repeatedly
planning delta-10.8120/+5.2058; inputs were unavailable, not issued commands that
proved a collision failure. The retained failure screenshot shows the new raid
panel. Replaying those coordinates with the real1280×720 UI confirms that the
full requested ground point is behind `#party-panel`. Its75%prefix is visible.

The formation planner now chooses a visible prefix before constructing its
strict arrival contract. Execution still validates that exact path/ground ray;
actor reservations, five-unit gathering bound and15-second deadline are unchanged.
It does not silently shrink an already-issued strict movement target or hide UI.
Seventy-six projection/preparation/formation checks pass1.298seconds, and both
real-layout cases pass18.2seconds. Full Fire acceptance is still unproven; there
has been no additional full rerun for this correction yet.

Private second-run checkpoint (not uploaded):
`/tmp/eidolon-party-checkpoint-fireraid0920b-9BjcrO/save.archive.gz`, SHA256
`24aa4629527a402383e5a9a874059ca0aa43322a947678a85013594fd0bd7f43`.

## First run — retained failure

Status: **failed, not full raid acceptance**. Run `fireraid0920a`, clean source4243e2e0,
Alpha1.9.20. Persistent exec session77329 confirmed running after checking owned
QA containers absent and ports18285/18286/4187 free. Launch only followed complete
CI35481615306 success and independent public verification of live1.9.20.

Launcher/log: `/tmp/eidolon-fire-raid-20260920-r1-iXo71H/`.
Luna `/root/watch_ember_0920a` reported terminal exit1 after7.8minutes. Main
confirmed `RAID_PROCESS_EXIT=1`, copied `test-results/` and `playwright-report/`
into this run directory, and verified no owned containers remain.

The first chamber cleared; all five remained alive. In the next elite chamber,
a MagmaGolem stayed at6340HP for60seconds. The tank moved from15.6units away
to within attack range, but failed to acquire the target under the pointer;
the final snapshot had no hovered/pending target. Retained approach records
show successful movement with zero recorded blocked stops, including a final
1.42/0.73unit step. This does not establish insufficient gear, a collision bug,
or a server damage failure. Do not relax watchdogs or repeat the full run
without narrowing the targeting cause. No guardian/repair/claim acceptance.

Local diagnostic follow-up captures the existing raycast hit stack, cache
membership, mesh visibility and hitbox owner only when the damage-stall watchdog
fires, plus one failure-scene screenshot before closing the leader browser.
It adds no recurring browser reads, input changes, retries or relaxed deadlines.
The current trace lacks those fields, so crowd occlusion versus cache/proxy
ownership remains unresolved. The next investigation should reproduce only
this saved elite-room formation/targeting problem, not rerun accepted raids.

## Bounded targeting reproduction

Using two recorded elite-room positions (target99997.203125/19592.751953125,
foreground99999.7265625/19594.291015625), the real procedural MagmaGolem
interaction boxes and the game's isometric camera direction reproduces a
concrete test-input defect: all six axial aiming samples hit the foreground
golem, while an upper corner still exposes the requested target. The regression
failed before the change and passes after adding four upper-corner samples to
the existing bounded pointer search. Every sample still requires real raycast
hover confirmation; a completely hidden target still returns no attack point.

Sixty-eight targeting/party-control checks pass in1.089seconds without launching
a browser, database or GPU workload. This is a two-actor static geometry
reproduction, not proof of the original complete moving crowd or full raid.
It does not alter gameplay selection, combat stats, watchdogs or retry policy.

The existing pointer component browser fixture also now reproduces those two
positions using actual MagmaGolem meshes, `projectEntity`, `InputManager`,
`GameEngine.performRaycast` and ordinary Playwright mouse movement. It confirms
six foreground hits followed by a genuine target hover on the exposed corner.
All three pointer cases pass in13.0seconds, including both existing loot-priority
cases. WebGL is disabled and main game boot is intercepted, so this does not
compete with deployment GPU work. No combat or networking outcome is simulated
or claimed. Artifacts: `/tmp/eidolon-golem-pointer-20260920-results/`.

Next: after CI35483868157 and independent public1.9.21 verification finish,
exercise Fire with this input correction and the already-added failure-scene
evidence. No native browser overlap with deployment. Rootheart and accepted
dungeon routes remain retained, not rerun. Do not publish another release just
for this test-only correction.

Private checkpoint, not uploaded:
`/tmp/eidolon-party-checkpoint-fireraid0920a-S8ZFB9/save.archive.gz`, SHA256
`21d9d01f5e40f9bb5ac3ceee02c723095bff736695a6b2cddb9d88c6885b5ed4`.

The existing prepared encounter fixture uses five distinct level70 characters:
Strong Fighter, two Wise Clerics, Brilliant Wizard and Agile Rogue, each with
five Rare/nine Uncommon legal equipped items. Prerequisite quest setup is not
earned campaign evidence. The tank healer/group healer split is retained.

Acceptance still requires ordinary invitations/ready/guide entry, complete
assault and Ashen Imperator combat, all three repair waves and ordered two-second
vent channels, alive participants/current updates, manual individual Ilyra
claims and saved re-login. Zero retries; no HP/stat/damage/watchdog relaxation.
The runtime includes the chamber-centered crystal repair correction. Last20
approach plans are retained in party attachments without extra browser calls.

This is the next distinct realm, not a substitute for incomplete Tidestar
repair/claims, Skyglass, other dungeon families, the earned campaign or the rest
of1.10. Rootheart and the previously accepted dungeon/arena/casino checks remain
accepted within their documented scope and are not being repeated.
