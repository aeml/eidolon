# Alpha1.79.81: roofs and deliberate interactions

Deployed and independently verified October18,2026, source
`17a5862eca203373d9e004d25fbbfb71f5d5458b`. All ten jobs passed in
[CI39127988589](https://github.com/aeml/eidolon/actions/runs/39127988589).
This accepts the scoped alpha milestone; it does not complete the full game,
final art, feature freeze, beta or1.99 requirements.

Delivered behavior:

- Town recall through B or the menu takes three seconds; movement cancels it.
- Quest objects use the same stationary three-second interaction. NPC quest
  acceptance and turn-in remain immediate, as the owner specified.
- Clicking into the world closes open windows before movement. Reopening
  retains their dragged positions.
- Fighter and Cleric basic attacks require actual close body contact, including
  vertical separation. Rogue/Wizard retain their designed ranged behavior.
- Players can land and walk on nineteen pitched town roofs, jump down or step
  off an eave. Saved roof positions and dropped items retain the proper floor.
- Earth boundary geometry uses the shared town-style timber/iron/lantern fence.
- Schema27 protects roof/drop custody from older writers. Updated stationary
  action admission rejects stale clients with readable reload guidance before
  world entry/resume token consumption. Phone cast progress clears the controls.

[Implementation and qualification](2026-10-18-release1-79-81-roofs-and-interactions.md),
[interaction checks](2026-10-18-gameplay-interaction-quality.md),
[phone layout](2026-10-18-mobile-cast-control-layout.md),
[jump endpoint rounding](2026-10-18-release1-79-81-jump-rounding.md).
The original jump/frame/input limits remain; this milestone makes no new global
FPS, all-device, campaign or whole-host recovery claim.

Exact-source pipeline results:

- Client:812suites/12,605checks passed. Hosted browsers:467passed/14skipped.
- Native predeployment:148passed/two skipped. This includes four actual copied,
  bundled Fighter/Rogue/Cleric/Wizard wardrobe cases, each retaining local/remote
  appearance, gear changes and fresh-login phases. The group passes in3.7minutes.
- Live gameplay/persistence/dungeon/movement: eight passed/one skipped;
  separate recovery and Well Rested groups pass two plus one cases. Total11live
  passes/one skipped. Reviewed browser/native/live logs have no retry or flake
  markers. Skipped cases and optional stabilization stages are not passes.
- The separately selected long-jump conditional fixture remains unexecuted;
  its archived correction is not included or accepted by this milestone.

The normal-TLS frontend manifest and backend health both report Alpha1.79.81
and exact source17a; backend status/database are ok/ready. Admission remains
open and terrain remains flat-v1. Pages artifact12138332718 comes from this
exact completed run.416fresh public file probes match full SHA256 and byte
size against that artifact, including changed runtime/assets and cumulative
notes.108unchanged GLBs reuse accepted78normal-TLS proof only after complete
CI-artifact byte/hash equality. Canonical worker SHA256 remains
`28b738eaf5aa3a9ba5df513fbd8c400f3d82a5f0f2624d529731c57b80a95f03`.
This verification uses ordinary bounded reads, not another gameplay/stress run.

Six final CI/public/scope/native/live evidence files retain inventory SHA256
`36a2852d25b12f5c54b1c00f933183d6b3dc07723b37d8c73ce95ea9c502e87a`
under `.qa-release81-recall-current/deployed-acceptance-v1` in the owned master
worktree. The separate completed hosted/server stage inventory SHA256 is
`671f2b05c8d8e3c7836bcced31bc66d7114b93a46a6992bf4cb0b2e465c5c2bf`.
An earlier concurrent optional snapshot observed a partially downloaded server
log and is retained as an incomplete observation; the sequential final inventory
proves completed file sizes/hashes.

Earlier failed81attempts remain retained, including obsolete jump clocks,
aggregate recovery timing, publication-fixture preparation and airborne recall
expectations. Their corrections have their own scoped receipts, including
[recovery watchdog](2026-10-18-release1-79-81-recovery-watchdog.md),
[publication escape fixture](2026-10-18-release1-79-81-publication-escape-fixture.md),
[stationary dungeon recall](2026-10-18-dungeon-stationary-recall-qualification.md)
and [report attachment privacy](2026-10-18-json-reporter-attachment-privacy.md).
Green current CI does not waive the separate movement-audio six-case findings,
original performance counterexamples, owner decisions or deferred human/device
feedback. Soak/stress remains deferred. The original dirty checkout is preserved.
