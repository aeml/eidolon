# Alpha 1.79.66 scoped acceptance

Runtime source: `ac430ab8be589cddc3643c9befaf1651b3b05eda`. [Exact CI](https://github.com/aeml/eidolon/actions/runs/38958381811) passes all ten ordered jobs,
both deployments and live checks. Roads now render behind actor names and auras,
including Well Rested. This accepts a bounded rendering/QA milestone; the full
game and its original release-readiness requirements remain unfinished.

Earth, Water, Fire and Air transparent ribbons explicitly draw after blackwater
and before default actor overlays. Depth testing, geometry, terrain conformance,
shadows and interaction retain their contracts. Two native High/Low cases cover
48 views with exact independent foreground-reference pixels; the original order
reproduces player-name, mob-name and aura overlap. Every road/overlay remains
visible. The first reference's unrelated transparent body-edge differences are
retained alongside the corrected sprite-isolated fixture; no tolerance relaxed.
[Road qualification](2026-10-16-road-overlay-qualification.md).

Flat party/PvP rings retain exact pixels from both sides with one fewer draw per
ring. High actor multi-draw owners now keep supported material variants separate,
synchronize appearance and retire every owned material. Actual four-class probes
eliminate their observed shader flag churn. Same-pose draw/triangle totals remain
exact; the original moving-window count difference's cause is unproved. Low cost
windows overlap/drift, so Low/Medium retain borrowed materials. This does not
clear original FPS, cold, whole-world or physical-device findings.
[Markers](2026-10-16-flat-party-ring-qualification.md),
[material ownership](2026-10-16-batched-material-qualification.md).

QA waypoints reject dead/zero-health characters before mutation. Existing bounded
party preparation precedes invitations after ordinary travel. Counter/race/save
and changed native Water-party setup checks pass; the original post-route death
finding and its unproved lethal cause remain recorded.
[Lifecycle qualification](2026-10-16-qa-waypoint-lifecycle.md).

Validation:

- 789 client suites / 12,075 tests, server/race, vulnerability and
  disposable integration gates pass.
- 451 hosted browser passes / 13 skips, 98 native passes / one skip, and all eight
  live main cases first attempt plus two recovery and one rested-party case.
  Four optional workflow steps remain skipped; no reported flakes.
- 450 distinct focused release checks across seven suites and full lint pass.
  Individual change qualification and its retained findings are linked above.
- 501 cumulative notes preserve all 500 earlier entries byte-exact, including
  23 legacy entries and 50 lazy pages.

The first source `312f56c0c` was rejected by workflow YAML parsing before any CI
job. A colon-space in the added test selector required a block scalar. The added
parsing check fails on that source and passes with the corrected workflow. The
first snapshot helper also had an incorrect expected note count; its failed log
and correction are retained. No manual CI rerun/cancellation or soak was used.
First-source seven-file inventory SHA-256:
`d0bfb3a2d0c0ad48d575b8f718ca156f6d59564bce48281c8bb25333eee06907`.

Copied publication has 4,802 files, 507 engine modules and 366 public asset pins.
Worker SHA remains `28b738eaf5aa3a9ba5df513fbd8c400f3d82a5f0f2624d529731c57b80a95f03`.
Normal-TLS public verification at **2026-10-16T21:00:17.637704+00:00** matches every pinned byte/hash,
both release identities, ready database, **registrationMode=open**, **flat-v1**
and the closed four-module analytics entry. Earlier transport findings remain.
[Previous scoped acceptance](2026-10-16-release1-79-65-acceptance.md).

Private release evidence: `/home/aeml/.local/share/eidolon-master-20261011/.qa-release66`. Frozen 39-entry
`acceptance-evidence.json` SHA-256: `589f4d0306b63176f7ed57f4d4184120ce4934614609be79a0a50794f95a55ea`. The explicit closed-file inventory
excludes mutable continuation and execution stdout.

Full original world/actor/combat/audio/story/economy/party/device/security/rights/
operations/owner/F1–F5/beta/cohort/1.99/handoff scope remains open. Installed-host
TLS/logging activation needs an administrator. Human pacing, physical-phone
feedback and soak/stress remain deferred. No beta/access/value activation or
full-game completion is claimed.
