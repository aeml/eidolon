# Ember Crown prepared-party validation — September20

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
