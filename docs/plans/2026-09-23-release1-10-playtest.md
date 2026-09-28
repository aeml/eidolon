# Alpha 1.10.0 — The Resonant Age playtest

User direction: finish the integrated work to the best of our ability, test it,
and deploy 1.10 for playtesting. This record supersedes older *current status*
paragraphs, not their retained test evidence. It does not equate implemented
features, automated checks and a complete human campaign playthrough.

## Current handoff — September 27

September 28 forward scope: use the [1.11–1.99 roadmap](2026-09-28-alpha1-11-to1-99-release-roadmap.md)
for planned beta and launch work. The physical Dark Realm portal was confirmed
missing: current entry is the Dungeon Guide's menu. Its replacement/presentation
is a concrete 1.12 deliverable, with compatible authoritative travel preserved.
This corrects the earlier “no further confirmed feature gap” assessment below;
the verified 1.10.2 deployment is not full roadmap completion. No new deployment
is made by adding this plan.

- **User-owned campaign validation:** the user explicitly chose “Leave
  campaign/pacing validation to our playtest; finish any remaining code gaps.”
  The uninterrupted earned campaign, real-player reward/economy progression and
  human pacing are therefore playtest follow-ups, not agent-blocking automated
  campaign gates. They are not recorded as passed. Retain accepted encounter
  evidence; do not launch a long campaign or repeat completed clears.
- **Verified live Alpha1.10.2:** exact8b2b955fbfa00e6fcdf3144ecb81eb6ea3d3a813,
  [CI36285496845](https://github.com/aeml/eidolon/actions/runs/36285496845),
  all ten jobs successful, including live character/animation/town-recovery QA.
  Public IPv4 verification passed matching client/server identities, ready
  database, login label, cumulative notes and five exact assets. Verifier:
  `/tmp/eidolon-release-1-10-2-20260927-VgeEbt/verify.mjs`; terminal watcher63417
  exited0. The read-audit fix is now delivered, not pending. No gameplay balance,
  currency or saved-character changes. IPv6 remains user-deferred/unverified.
  The optional casino hardware profile started only after full CI success, at
  QA-only descendante88c8538; see its [predeclared contract](2026-09-27-casino-frame-profile.md).
  Campaign/human pacing now belong to the user's playtest. Other outstanding
  checks retain their stated scope.
- **Casino profile completed, not accepted:** one29.2-second native hardware
  run ate88c8538 collected all four High/Low floor views with180frames each.
  High passes; Low medians20.1/20.3ms miss the predeclared20ms target, while all
  p95 values pass. Retain the [measurements and limits](2026-09-27-casino-frame-profile.md);
  do not rerun unchanged or relax the target. Four screenshots were inspected.
  No profile or deployment remains running. This does not change live1.10.2.
- **Remaining local code:** hidden-floor status animation and actor scene
  traversal optimizations are committed but unshipped. Their38 focused checks
  pass; the changed-build hardware timing result is not accepted. At03:22UTC
  the shared host still had29–42 runnable tasks and5–7% CPU idle on16 logical
  CPUs. No additional timing run was started. See the [candidate and measured
  limits](2026-09-27-casino-frame-profile.md). The source review found no further
  confirmed feature gap; this is not a claim of bug-free software. Live1.10.2
  remains available for playtesting while that performance follow-up is held.

The candidate/next-batch notes immediately below are historical; the verified
1.10.2 receipt above supersedes their publication status.

- **Alpha1.10.2 release candidate:** packages the tested read-audit recovery fix
  with synchronized login/package/server/CI versions and cumulative patch notes.
  Publication is now the next delivery step; no additional gameplay defect was
  confirmed by the latest acceptance reconciliation. Do not claim it live until
  its full pipeline and exact public identities pass. Retain all accepted
  encounters; no campaign rerun is required for this read-only admin change.
- **Next-batch fix, not deployed:** administrator status/player/history reads
  now retain their exact audit entries through the existing outbox when the
  database append fails, without exposing privileged data. Focused reproductions
  failed before and pass after the correction; journal reopen/replay and dual
  outage recovery are covered. See the [read-audit follow-up](2026-09-20-admin-rejection-audit-recovery.md).
  Batch this small fix with the next release; do not rerun accepted encounters
  or start a standalone release solely for this change. No production data was
  changed. Uninterrupted campaign automation remains unstarted pending the
  optional user preference; existing scoped encounter acceptance is retained.
- **Verified live Alpha1.10.1:** exactf8a9b051c4043ad5a64cfaa57444a40df0515620,
  [CI36283549819](https://github.com/aeml/eidolon/actions/runs/36283549819),
  all ten jobs successful, including Go/client/browser gates, both deployments,
  and live character/recovery QA. Independent public IPv4 verification confirms
  matching frontend/backend version+commit, ready database, login label,
  cumulative patch notes and five exact runtime/style assets. Verifier:
  `/tmp/eidolon-release-1-10-1-20260927-EaoGYx/verify.mjs`. No production account
  mutations were used by that verifier. IPv6 remains user-deferred/unverified.
  All native encounter queues are finished; do not rerun accepted encounters.
  The complete uninterrupted fresh campaign and human pacing remain unproven,
  distinct from the now-accepted scoped group encounter/repair/reward evidence.
  The overall roadmap goal remains open; this release is ready for playtesting.
- **Accepted Water clear:** `finalwater0926h` passed in46.4minutes at1f8e1357.
  All five prepared class-geared raiders survived Tyrant and all three defended
  repair waves, received personal restoration credit, manually claimed their
  individual108906XP/1200Gold rewards, and retained completed Tidestar and
  offered Ember Crown chapters after relogin. Final balances for all five:
  level70/114586XP/2789Gold. Effective healing51398/60239; all damage roles
  contributed. Root collected terminal exit0 and inspected the restored-crystal
  screenshot; credential scan passed. Unchanged archive:
  `/tmp/eidolon-party-checkpoint-finalwater0926h-V6ftfA/save.archive.gz`, SHA
  68c7b041ef4e9b98701405004d5ca37f0a2535bfb70bc7f336b15f6664206086.
  All elemental raid encounter/repair checks are now accepted within their
  recorded prepared-party/saved-continuation scopes. Do not replay them.
  No native expedition remains queued.1.10.1 notification polish is ready
  for publishing checks and exact live verification, not yet deployed. Full
  uninterrupted fresh-campaign acceptance and human pacing remain unproven;
  phone dungeon/party feedback and IPv6 remain user-deferred.

- **Accepted Air clear:** `finalair0926h` passed in46.7minutes at359c4c46.
  Five prepared level70 class-specific Uncommon/Rare raiders completed Tempest
  Sovereign, all three defended repair waves and personal restoration receipts,
  individual manual claims and relogin persistence with Dark Shore offers.
  All five survived and finished level71/36676XP/3008Gold; each received the
  exact148906XP/1400Gold quest reward. Effective Cleric healing80296/67005;
  all three damage roles contributed. The crystal-restored screenshot was
  inspected and the credential scan passed. Root collected terminal exit0.
  Archive `/tmp/eidolon-party-checkpoint-finalair0926h-rmELvG/save.archive.gz`,
  SHAeac060cace2d7d5ab685301cec4962a9ec9b1ce198cb7b1e7e17e9374a60acb5,
  is retained unchanged. This accepts a prepared-party encounter/quest route,
  not an uninterrupted earned campaign or human pacing measurement.
  **Do not replay Air.** Water `finalwater0926h` at1f8e1357 starts after Air's
  cleanup and is the only remaining elemental raid clear. The release remains
  local1.10.1 / verified-live1.10.0; no new deployment has started.
- Current active run: Air `finalair0926h` at359c4c46, after Water g cleanup.
  Water `finalwater0926g` stopped in22.2minutes, after Tyrant and the start of
  repair wave1. All five survived with1045Gold and0/1 unclaimed repair credit;
  effective healing13581/9629. The Wizard's1.275-unit combat follow stopped
  after0.196units with a collision receipt; the tank occupied its path at the
  final observation. This is incomplete movement, not a successful step.
  Combat follow now retains original body poses/collision count and uses the
  existing strict spacing-interruption classifier. Only a witnessed known body
  moving from clear to obstructing, new matching collision stop, single actual
  canvas walk, living same-instance actor and unchanged origin permit the next
  tick to replan. It never reports movement success or resets encounter timers;
  unexplained failures and ordinary traversal still fail.87 focused controls/
  interruption tests pass in2.465seconds; lint and whitespace pass. Regression
  final geometry is recorded, but its initial clear tank pose is explicitly a
  fixture, not a recovered native sample. Native confirmation remains required.
  Archive `/tmp/eidolon-party-checkpoint-finalwater0926g-YFbARI/save.archive.gz`,
  SHAdd419d46d876209853a8ed76bad1642f2343ead196351c29958bb72dd881293f,
  remains unchanged. Air's frozen running source has not been edited.
  Water-only `finalwater0926h` at1f8e1357 is queued under
  `/tmp/eidolon-water-crossing-20260926-NiBswB/run.sh`, requiring Air's terminal
  marker and owned-container cleanup. One bounded attempt, no retries,
  repeated accepted encounters or deployment overlap.
- Current active run: Water `finalwater0926g` at646e5545, after Air g cleanup.
  Air `finalair0926g` cleared Sovereign and waves1/2, then failed in41.2minutes
  when the tank Cleric died during wave3 (wind anchor3/4). Other four survived;
  all had1612Gold and unclaimed0/1 repair credit. Effective healing81509/69721.
  Recorded decisions show the Cleric at406 then85/2975HP still selecting its
  assigned tank at2453 then2457/3025HP. At85HP it chose aura instead of the ready
  direct heal because the selected tank was above55%. Anchored healer selection
  now prioritizes a below40% reachable ally when its assigned anchor is above60%;
  urgent tanks retain priority, and no distant ally chase overrides assignment.
  The exact self/healthy-tank case and boundaries are covered;61 focused healing/
  Vigil tests pass in2.045seconds, scoped lint and whitespace pass. This changes
  QA input selection only, not production healing, damage, stats or deadlines.
  Archive `/tmp/eidolon-party-checkpoint-finalair0926g-0rFTQq/save.archive.gz`, SHA
  1a15fb00673ada8b235a2d9411d17f4a45db9f95f5ba57384a9bde775ebd65cb,
  remains unchanged. Water's currently running frozen source is unchanged.
  Air-only `finalair0926h` at359c4c46 is queued under
  `/tmp/eidolon-air-triage-20260926-mX41o5/run.sh`, gated on Water's terminal
  marker and owned-container cleanup; one bounded attempt, no retries or
  deployment overlap. Accepted encounters are not repeated.
- Prior Water f result:
  Water `finalwater0926f` failed in43.2minutes with all five alive/full health
  in the final snapshots,1434Gold and0/1 unclaimed repair credit. It cleared
  Tyrant and waves1/2, then the Rogue's combat recovery follow moved0.605units
  after a1.067-unit click but missed the exact waypoint. The already committed
  646e5545 short-step correction accepts this witnessed combat displacement
  (threshold0.533), still rejects zero movement and still rejects this as exact
  formation; the recorded geometry was checked directly without another code
  change. Effective ally healing58759/42695. Archive remains untouched:
  `/tmp/eidolon-party-checkpoint-finalwater0926f-QwX78W/save.archive.gz`, SHA
  04815651ed6ee6797321bb4db7baa493a07cd56b28a299b4e49c51a6d3300663.
  Water-only `finalwater0926g` uses the same646e5545 source, queued under
  `/tmp/eidolon-water-follow-20260926-X7kuKQ/run.sh`, gated on Air's terminal
  marker and owned-container cleanup. One bounded attempt, no retries or
  repeated accepted encounters. No deployment has started.
- Prior Air `finalair0926f` result and short-step correction:
  Air `finalair0926f` stopped in19.2minutes during Tempest Sovereign; all five
  were alive with1107Gold and no repair credit. A0.692-unit escort follow step
  moved0.979units but a moving body deflected it outside the fixed0.25-unit
  waypoint region. Combat-follow observation now witnesses displacement scaled
  to the requested step (half its length, capped at1unit), without claiming
  settled formation. Exact formation arrival, collision/projection/origin,
  living/same-instance checks and all encounter deadlines remain unchanged.
  The recorded geometry still fails exact formation and passes combat-input
  observation; no movement and0.1-unit jitter still fail.103 focused formation/
  observation tests pass in1.158seconds; scoped lint and whitespace pass.
  Archive `/tmp/eidolon-party-checkpoint-finalair0926f-pXNWsI/save.archive.gz`,
  SHAcc90f8815647894b89cb2b2ac9fb7e93dfb1f83b451e368bef50c8eefaef63b8,
  remains unchanged. This is a QA correction, not a production game change.
  Water's running source is frozen and is not edited. Air-only `finalair0926g`
  at646e5545 is queued in `/tmp/eidolon-air-follow-20260926-unu9Zv/run.sh`;
  it requires Water's terminal marker and owned-container cleanup. Single
  bounded attempt, zero retries, no repeated accepted encounter or deployment
  overlap. It also includes the prior late-arrival confirmation correction.
- Latest queue: Air `finalair0926e` failed at38de1fd0 (result below). Water
  `finalwater0926e` failed at60a791f6 under
  `/tmp/eidolon-water-support-20260926-7QmXo5/run.sh`; it waits for Air's
  terminal marker and owned-container cleanup before starting. Water uses the
  recorded walking-tank support correction below. Both are single attempts,
  with unchanged encounter limits and no retries. Fire, Nexus, Tempest and the
  finale remain accepted and are not repeated. No deployment has started.
- Water `finalwater0926e` stopped in45.7minutes with all five alive, after
  Tidebound Tyrant and two repair waves, during wave3. All had1347Gold and
  unclaimed0/1 crystal credit; effective ally healing55638/41124. The escort's
  real move-only click walked11.871units and settled0.145units from its target,
  but the polling deadline rejected its delayed observation. The existing final
  settled-arrival confirmation now also covers move-only clicks without an
  explicit formation region: accepted canvas click, same instance, living/idle,
  within0.25units of the clicked point, and the original displacement threshold.
  No extra input, expanded timeout, partial-step acceptance or game change.
  All73 focused movement/arrival tests pass in2.086seconds; scoped lint and
  whitespace checks pass. Archive remains unchanged:
  `/tmp/eidolon-party-checkpoint-finalwater0926e-GmUBg4/save.archive.gz`, SHA
  779c90dc2b32b4770033947ee3cbd12a7813282890da469155456143b8441f07.
  Root collected Water's terminal handle; Air `finalair0926f` at5ab1aa49 has
  started after cleanup, with no edits to that frozen source. Water is still
  not accepted; retain its failed result, not a crystal-restoration claim.
  Water-only `finalwater0926f` at073771b1 is queued under
  `/tmp/eidolon-water-arrival-20260926-ujJ2Hm/run.sh`, requiring Air's terminal
  marker and owned-container cleanup. One bounded attempt, no retries. Do not
  alter the15-minute logout rule or old archive timestamps to reuse expired
  raid progress, and do not replay any accepted encounter.
- Air `finalair0926e` defeated Tempest Sovereign and cleared repair wave1,
  then failed during wave2 in32.2minutes. Both Clerics and the Rogue were dead
  in the final snapshots; Fighter/Wizard survived. All five had1246Gold and
  unclaimed0/1 crystal credit. All four wave2 wind handoffs completed, but enemies
  remained. The escort Cleric was48.3units from the tank after its assignment
  ended, repeatedly self-healing through325Harpy/447Giant attacks without
  regrouping. Effective ally healing was69156/45886; this is not evidence of
  broken healing. The failure screenshot was inspected. Untouched archive:
  `/tmp/eidolon-party-checkpoint-finalair0926e-PD1EAa/save.archive.gz`, SHA
  9ffe52dd77a2a7538b06f75e924a77cfddab5455a7b37d38dcbf832f26def77c.
  The escort now follows the tank after the actual objective completes, only
  during direct-heal cooldowns or when nobody needs healing. Ready heals,
  active ritual assignments, warning safety and ordinary collision-checked
  movement retain priority.60 focused healing/Vigil tests pass in3.623seconds;
  scoped lint and whitespace checks pass. This QA tactic needs native evidence;
  it changes no production stats, damage, rewards, deadlines or survival gates.
  Water's frozen running source is unchanged. Air-only `finalair0926f` at
  5ab1aa49 is queued under `/tmp/eidolon-air-escort-20260926-hQ6Cg5/run.sh`,
  gated on Water's terminal marker and owned-container cleanup. It includes
  the walking-tank correction and escort regrouping; one attempt, no retries.
- Verified live remains Alpha 1.10.0 at e67fc0ad1b924002758e67e5a3a3bcb615d97476.
  Alpha 1.10.1 is a local, undeployed notification-polish candidate. Login,
  package and server version defaults and cumulative notes agree; all 293
  focused release/version/asset checks pass. Accepted native notification
  presentation checks are recorded below; no repeat finale run is required.
- Air continuation `earnedair0925d` passed in34.7minutes at4f640e2a: collection
  8/8,16 observed collection-target deaths, no player deaths, Stolen Horizon3/3,
  manual rewards, checkpoint/relogin and saved Tempest handoff. The actual save
  independently confirms level100/245125XP/374513Gold,5461HP/4680MP, completed
  collection reward500Gold/35738Resonance XP and investigation250Gold/5956Resonance
  XP. Tempest is accepted with0/1 and not completed. The unchanged archive is
  `/tmp/eidolon-party-checkpoint-earnedair0925d-7X2SsQ/save.archive.gz`, SHA
  92308f1031e2e29be16c8006c4524fefcc23b16d7a0f754b6f5baae10d142b2c,
  registered as checkpoint25. The isolated inspection database was removed.
  Continue with the earned Wizard and three class-geared support characters;
  do not replay Air or claim that all four party characters earned its history.
- Water/Fire/Air crystal raids and Umbral Nexus remain open. Batch r3 at70583f18
  stopped on Water after23.2minutes; all five alive, Tidebound Tyrant defeated,
  first repair wave still incomplete. Fire/Air/Nexus never started. The Rogue's
  spacing input projected a relative step after its origin moved about17metres,
  then checked arrival against the old plan. Preparation now rejects stale
  origin/instance and checks it again before clicking; normal replan loops retain
  the same deadlines, collision, living-player and arrival assertions. This is
  a QA correction, not a production movement fix or a successful Vigil.92 focused
  movement checks and188 checkpoint/projection/formation checks pass; scoped lint
  and whitespace checks pass. Native confirmation remains required.
  Logs: `/tmp/eidolon-remaining-encounters-20260925-r3-NLfnnW`.
  Retained Water save: `/tmp/eidolon-party-checkpoint-finalwater0925c-jncY7K/save.archive.gz`,
  SHAdebf92bb3b14a0f546901f9cd84274824799484843863651ccb0092c1b845671.
  Both runs cleaned up; no automatic retry or active old batch remains.
- Next native batch started at f0cc6e71 under
  `/tmp/eidolon-final-encounters-20260926-Ox4Ijm`: earned Wizard plus three
  class-geared supports in Tempest, then prepared Water/Fire/Air raids and
  Umbral Nexus. Runs are sequential, bounded, zero-retry and stop on first
  failure. Tempest passed; Water subsequently failed and the batch stopped.
  Fire/Air/Nexus did not start. No new deployment has started.
- `finaltempest0926a` passed the complete four-role Tempest route in39.5minutes:
  all encounters through Zephyrion,14 room traversals,4 town recoveries, no
  deaths, individual manual claims and completed-run recall/re-entry preserving
  seed, boss clears and Gold. The final boss approach screenshot was inspected.
  The actual earned Wizard save independently confirms level100/245125XP,
  378904Gold,5461HP/4680MP and the claimed Tempest reward700Gold/59562Resonance XP;
  Rootheart is offered, unaccepted and0/1. The three support characters were
  prepared level70 class-geared fixtures, not earned campaign characters.
  Archive `/tmp/eidolon-party-checkpoint-finaltempest0926a-pw1XnQ/save.archive.gz`,
  SHA751fddc4399d6be6f46405d23841be982735ebedeff84f3050adae80615e7402,
  is registered as checkpoint26;105 checkpoint tests pass. The inspection
  database was removed without modifying the original archive. Retain this
  full clear rather than replaying it solely for a later version or document.
- `finalwater0926a` stopped after41minutes on a60-second no-damage guard while
  still approaching a Frost Guardian: observed distance113→110→99→79metres,
  target11550HP. This is not a demonstrated attackability defect. The initial
  approach now has a60-second measurable-distance-progress guard; first damage
  or reaching basic range permanently starts the60-second damage guard. Idle,
  oscillating and sub-unit-jitter approaches still fail; moving away or switching
  foreground targets cannot reset combat stalls. The same8-minute target budget
  and2-hour whole-expedition cap remain nonrenewing.24 focused timing/death
  observation checks and scoped lint pass. This QA-only correction requires
  native confirmation; no production HP, rewards, speed or geometry changed.
  Archive `/tmp/eidolon-party-checkpoint-finalwater0926a-BBkBTT/save.archive.gz`,
  SHAf86af5b080b88a7bd37368ed418c367d3c1d6ad431777e9413d0dc276d2afc59.
  Root confirmed the old wrapper ended, no owned Water containers were running
  and ports18307/18308/4197 were clear. Retain Tempest's pass; do not replay it.
- The corrected remaining-encounter batch is now running at bff2c1b9:
  `/tmp/eidolon-remaining-encounters-20260926-r2-mfwnDe`, Nexus→Fire→Air→Water.
  These are independent prepared-party checks, run sequentially without retries.
  Unlike the old stop-first batch, each failure is retained and the next check
  may run only after confirming prior owned containers are gone. This collects
  distinct remaining results without repeating Tempest or allowing overlapping
  expeditions. Luna reports terminal outcomes. Nexus passed; Fire's combat and
  restoration completed but its stale terminal QA flag failed (details below).
  Air and Water subsequently failed; the batch is terminal and its owned
  services are gone. Fire's saved manual-reward continuation passed below.
- `finalfire0926b` ended with all five players alive, all three wave-clear events,
  `3:complete`, crystal stage `restored` and personal repair quest1/1, unclaimed.
  Its final bounded fight crossed the30-minute ritual loop-start deadline; the
  local `restored` flag was not read again before the assertion. The driver now
  reads authoritative crystal state once after the loop, without starting more
  combat or extending any deadline. This is a QA-only correction, not a game
  defect or a full accepted reward route. The two Clerics recorded125373/83068
  effective ally healing; no player death was observed. The untouched archive
  `/tmp/eidolon-party-checkpoint-finalfire0926b-1UGY7j/save.archive.gz`, SHA
  8a8a777f55f3351702c44f505d07928c91a2d458a411faca885b95c38956f8c4,
  independently confirms all five level70/6895XP/1849Gold survivors with the
  accepted, unclaimed Fire repair credit and148906XP/1400Gold reward quote.
  Its temporary inspection database was removed. A short saved continuation
  reuses the existing finale turn-in route with `EIDOLON_E2E_SAVED_RAID=fire`;
  expected normal reward is level71/36676XP/3249Gold and the Skyglass offer.
  This must wait for the current batch to finish, preserve original logout
  timestamps, and verify individual claims/relogin without replaying the raid.
  Frozen continuation90ba7ded is queued under
  `/tmp/eidolon-fire-reward-20260926-OoRqOE`; it waits for the original wrapper's
  terminal marker and owned-container cleanup, then runs once with a10-minute
  native test limit. Scoped lint, all11 Vigil-control unit tests, Playwright
  discovery and whitespace checks pass. Luna monitors the terminal result.
- `savedfire0926a` passed in4.1minutes on90ba7ded: all five actual survivors
  manually claimed1400Gold/148906XP exactly once, reaching level71/36676XP/
  3249Gold, with the Skyglass Vigil offered but unaccepted. Every personal
  receipt and balance survived login and reopening Ilyra; waiting members
  remained unclaimed. The rendered handoff screenshot was inspected. The save
  `/tmp/eidolon-party-checkpoint-savedfire0926a-9U14ok/save.archive.gz`, SHA
  e6a340608d1f82bb86350dfa2e29c7ed18a6233c6000e53fa79cee04a020bfd3,
  is retained. The original57.3-minute Fire combat/restoration and this exact
  continuation establish the prepared-party encounter/reward path, not an
  uninterrupted earned campaign or human fight-duration result. Do not replay.
- `finalair0926b` failed after21.2minutes during Tempest Sovereign combat, all
  five alive, before crystal repair. The secondary healer's direct follow
  inputs crossed boss/teammate bodies; displacement was only0.278units. Combat
  following now reuses the existing floor/body-aware formation planner, strict
  projection/origin/arrival checks and ordinary walking. A recorded overlapping
  boss/two-teammate case exposed missing combined departure directions; the
  bounded planner now offers16 short candidates, still checking every entire
  edge against all bodies/floor. No collision radius or failure assertion was
  weakened. The recorded regression and all65 formation tests pass. Archive
  `/tmp/eidolon-party-checkpoint-finalair0926b-gPZcNw/save.archive.gz`, SHA
  5fa19df11eef4692ca695a5b4b3fd8d12b53eccf72e755ff80ccde18ef977594.
- `finalwater0926b` failed after37.9minutes in repair wave2, all five alive.
  The Rogue's optional spacing path was clear when planned; an Aqua Golem
  crossed it at the recorded real click and had left again by the timeout
  snapshot. The existing interruption classifier now also accepts the known,
  active body's witnessed click-time pose, retaining the same incremented
  collision counter, exact blocked target, live/same-instance and single-input
  guards. This records an interruption, never successful movement; unexplained
  failures still propagate. The recorded regression and negative cases pass;
  all101 formation/spacing checks pass across the focused runs. Scoped lint
  and whitespace checks pass. Archive
  `/tmp/eidolon-party-checkpoint-finalwater0926b-DU6orK/save.archive.gz`, SHA
  610f94e3b7cb3a4b99d8f9e8ae1eb6f6d013c4c7c2136962091db000d02a4e87.
  Both corrections are QA-only and need native Air/Water confirmation. Existing
  encounter/expedition deadlines and15-minute saved-run expiry remain unchanged.
  Luna's watcher stopped at its usage limit after the Air report; root confirmed
  both remaining terminal logs and absence of owned services directly.
  The corrected, frozen67393a8e batch is now running under
  `/tmp/eidolon-air-water-20260926-E82svp`: Air then Water, five class-geared
  level70 players, one attempt each, sequential with owned-container cleanup
  guards. The Fire saved reward pass is a launch prerequisite. Neither accepted
  Fire/Nexus nor the finale is repeated, and no production deployment overlaps
  this native queue. Read terminal results from this exact batch before deciding
  further work; the previous batch and Fire continuation are completed handles.
- `finalair0926c` stopped after19.9minutes during Tempest Sovereign, all five
  alive. The second healer did make1.859units of actual movement on its planned
  1.5unit departure, but the moving boss deflected it away from the frozen
  waypoint. The newly reused formation observation required progress toward
  that point, even though combat support replans to a moving ally each tick.
  Combat following now uses ordinary greater-than-one-unit displacement for
  steps longer than1.25units, retaining live/same-instance post-input checks;
  short corners and actual dungeon formation retain their arrival contracts.
  Path/body validation, input origin checks, real healing, survival and target/
  expedition progress budgets remain unchanged. This is input acceptance, not
  proof of reaching support range or a completed raid. The recorded regression
  explicitly still fails formation arrival and refuses an unmoving input.
  Archive `/tmp/eidolon-party-checkpoint-finalair0926c-j6KE2Z/save.archive.gz`, SHA
  36d89ba89e004e74867278dbcc74656361001c49ffe9eac3b70562c544f7406b.
  Water is still running on frozen67393a8e; do not alter or restart that attempt.
  The80 focused formation/movement tests and scoped lint/diff pass. Air-only
  `finalair0926d` atfe0fb99c is queued under
  `/tmp/eidolon-air-final-20260926-krGvMm`, waiting for that exact batch PID and
  terminal marker plus owned-container cleanup. One fresh bounded attempt,
  zero retries; no changed logout timestamps or fabricated saved boss state.
- `finalwater0926c` ended after33.1minutes in wave2, all five alive, on the
  unchanged60-second initial-approach stall guard. The retained consecutive
  observations show clear perpendicular steps alternating in opposite directions
  beside the same teammates, while the selected Frost Guardian stayed distant
  and undamaged. The occluded-target planner now tries forward diagonals before
  perpendicular probes for distant targets. Its regression walks the recorded
  geometry into attack range through collision-clear segments with monotonic
  distance reduction; all9 target-approach tests and scoped lint/diff pass.
  Nearby crowd handling, collision checks and combat/expedition budgets are
  unchanged. This is another QA-only correction, not a production movement fix
  or an accepted Water Vigil. Archive
  `/tmp/eidolon-party-checkpoint-finalwater0926c-9PuwJc/save.archive.gz`, SHA
  94736598c3de3152986f7c516e333dc3e668fa0d4b082060b92150987a6850e0.
  The Air/Water batch is now terminal; Air-only `finalair0926d` has started after
  its cleanup. Keep that frozen run intact, then verify only corrected Water.
  Water-only `finalwater0926d` at861c3f3b is queued in
  `/tmp/eidolon-water-final-20260926-GpPW6e`, waiting for Air's exact wrapper
  PID/terminal marker and service cleanup. It runs once with the same five
  level70 class-geared players and existing bounds, without native retries.
- `finalair0926d` cleared Tempest Sovereign and reached the first repair wave,
  then failed the survival assertion after28.3minutes: the Wizard died at wind
  anchor3 to repeated325-damage Harpy attacks while both healers were about30
  units away. All four physical wind handoffs had completed. This is a real
  failed encounter, not an input-observation false negative. The test driver
  gated even self-shielding behind the tank's first hit on its selected enemy,
  and an unassigned runner could wait alone after handing off its anchor.
  Self-protection now precedes that offensive gate; the Wizard's self-shield
  does not require the tank target to be in spell range. Unassigned ritual
  runners outside9units rejoin the nearest living same-instance healer through
  ordinary collision-checked movement. Assigned runners retain their markers;
  offensive attacks still wait for real tank damage.49 focused role/Vigil tests
  and scoped lint/diff pass. No stats, gear, damage, healing, rewards, survival
  assertion or time limits changed. Native Air acceptance remains open.
  Archive `/tmp/eidolon-party-checkpoint-finalair0926d-Dt5kxx/save.archive.gz`, SHA
  b3ff0bfeef094efe497c6dcad233634c3908af591e84371629fc3a8423772f0f.
  Root collected the terminal Air handle; Water-only `finalwater0926d` started
  after Air cleanup and remains unchanged on861c3f3b.
  Air-only `finalair0926e` at38de1fd0 is queued in
  `/tmp/eidolon-air-recovery-20260926-u65to6`, behind Water's exact wrapper PID,
  terminal marker and cleanup. One corrected, bounded attempt; no other accepted
  encounter is repeated and no deployment/browser overlap is allowed.
- `finalwater0926d` cleared the guardian and two repair waves, then the Fighter
  died in wave3 after47.6minutes. The last two enemies remained alive; this is
  not a completed Vigil. Both Clerics had full mana and ready heals but were
  roughly40units behind the final pull, closing36→24 and40→28→17→7units while
  the tank's health fell. The secondary healer selected its heal at309HP, too
  late. They recorded65177/50251 effective ally healing over the run. The next
  prepared raid uses ordinary walking rather than uncoordinated long Charge
  inputs so the tank does not deliberately outpace its walking support. Dungeon
  Charge coverage and all production stats, collision, damage/healing, gear,
  death assertions and time budgets are unchanged. This is a test-party tactic,
  not a demonstrated production healing defect or accepted raid clear.
  Archive `/tmp/eidolon-party-checkpoint-finalwater0926d-g5dtO1/save.archive.gz`, SHA
  f36836ec734795a2f34149b79823d1d04aa246d5ebba750230c9f2de0d9798dd.
  Water's terminal handle is collected. Frozen38de1fd0 Air `finalair0926e`
  has now started after Water cleanup; do not alter its running source.
- `finalnexus0926b` passed in14.9minutes at bff2c1b9: full Umbral Nexus through
  Eidolon Devourer,6 room traversals,1 town recovery, all four alive, individual
  manual rewards and Dark King offers, then completed-run recall/re-entry with
  preserved seed/clears/Gold. The Cleric recorded17506 actual ally healing;
  all three damage roles dealt damage. All four final balances were4302Gold.
  This uses prepared level100 class-specific Rare+4 builds and prior quest
  prerequisites; it is an encounter/transition check, not an earned Dark Realm
  expedition or human duration measurement. Retained save
  `/tmp/eidolon-party-checkpoint-finalnexus0926b-k1WPmw/save.archive.gz`, SHA
  f474680560128890aa1dccfd6591f30238013f8af1e4d05574d4f70cf745df6b.
  Do not replay this accepted clear for later test-only or documentation work.
- The existing55-chapter graph regression now exercises every Dark Realm hunt
  through its district/enemy consumer and all four collection items through
  personal drop creation and normal pickup, rather than inserting those items
  directly. All24 expedition conversations use the shared-realm Ilyra, and the
  check rejects premature Nexus access, early turn-ins and duplicate rewards.
  Focused graph/Dark Realm tests pass in2.463seconds. Positions and successful
  drop rolls are controlled unit fixtures: this proves objective integration,
  not combat, navigation, persistence, drop pacing or human campaign duration.
  The retained Air final-discovery screenshot was inspected: all three lore
  records are readable in the Journal with the Stolen Horizon marked Ready.
- The Dark King kill plus exact saved continuation have verified all five
  players' rewards, epilogues and persistence. This is not an uninterrupted
  earned campaign. Human campaign timing remains a playtest question; phone
  dungeon/party feedback and the separate IPv6 issue are user-deferred.

Older dated entries below retain the sequence and limitations of each run;
this handoff and the latest result for each named route govern current status.

## Final progression changes

- New story offers prepare players for the real regional enemy/dungeon levels.
  Earth offers total200,300XP before its dungeon; all12 readiness scenarios
  reach level30 without dailies. Regional checks require no unexplained entry
  deficit beyond the preceding dungeon's actual generated rewards.
- Ordinary XP is interpolated through level/XP anchors1/5,10/26,30/65,60/170,
  80/250,100/380. Elites pay3x; bosses pay a personal8x content-level award.
  Ordinary party sharing is unchanged. Fresh boss dailies pay10% of their
  corresponding encounter budget; overlapping daily receipts remain bounded.
- The sequential forecast pays story rewards *after* objective work. Assumptions:
  90 ordinary kills and3 elites/hour,2 bosses and8 rooms/hour after level30,
  four-player combat throughput3x with actual shared receipts,4minutes per
  investigation site,35minutes/dungeon,40minutes/raid,40% collection drops,
  no daily or Fortune income. Reference50%-rested scenarios forecast95.5hours
  solo /90.8hours coordinated party to100; solo first dungeon2.36hours.
  These are model outputs, **not measured human playtime**. Most remaining
  leveling time is at80–100; repeat-content enjoyment and that late-game pacing
  especially need playtest feedback. Dark Realm8–12hours remains a target.
- No saved level curve/schema migration, gear rewrite, Gold balance change or
  accepted reward repricing. Explicit zero quotes and investigation progress
  also survive catalog refresh. Capped quest XP still becomes Resonance XP.
- Forge potency prices through reaching+8 remain1,2,4,8,16,32,64,128Hearts.
  Later steps use256+32*n*(n+1),n=currentPotency−8. The final+19→+20 step
  costs4,480Hearts, payable from five normal stacks instead of an impossible
  524,288. Total+0→+20 costs21,631Hearts. Client quotes and server transactions use matching rules. +20 remains
  a long-term endgame goal; no exact acquisition-hour claim is made.

## Verification and retained evidence

**Current finale result — September25:** the four-phase five-player kill from
`endgameking0924a` and its exact saved continuation `savedfinale0925b` now verify
all five survivors' individual finale rewards, rendered epilogue and relogin
persistence. The latter passed in4.4minutes at `b3cef857`, with all five final
balances20516Gold/245125XP/1502410Resonance XP. The previously claimed Fighter
was not paid twice; each of the other four manually received5000Gold and
490250Resonance XP, without completing another player's quest. Ilyra could be
reopened after each login; the epilogue screenshot was inspected. This closes
the post-clear turn-in failure without a production reward change. Keep the
prepared-prerequisite and saved-continuation scope explicit: it is not an
uninterrupted earned campaign. A separate later combat attempt stopped on a
movement-controller diagnostic; that remains distinct from the accepted kill.
All owned finale services were cleaned up. Air continuation remains incomplete;
no Air/Tempest completion claim yet.

Pending follow-up polish: the reviewed epilogue screenshot exposed an empty
“Attack power” row in narrative notifications because they reuse the target
card. Callout styling now hides only that attack row; normal target selection
restores it.80 focused feedback/lifetime checks and scoped lint passed. The
existing desktop/phone presentation case now checks hide/restore and captures
the Chronicle notice. All five native presentation cases passed in31seconds
at002b609a; the phone Chronicle screenshot was inspected and the empty attack
row is gone.
This visual change is local, not yet deployed; include it in the next release's
patch notes rather than triggering a separate deployment for test-only work.

Air monitoring: direct saved-position reads confirmed travel from roughly
x599 to1071 to1534, with the first hunt at1/30; this is not a stationary timeout
or completed Air route. Repeated bag visits also showed the driver re-enabling
auto-loot before returning through unrelated roadside enemies. Future inventory
visits now restore the original loot setting **after** the normal return trip,
so the cleared bag is not immediately refilled in transit.27 inventory checks
and scoped lint passed. The active frozen Air run is unchanged; no items were
deleted, drop rates altered or quest rewards/credit injected.

Latest Air result (`earnedair0925a`, source b3cef857): stopped after13.9minutes
with the Verdant dungeon-entry modal visibly covering ground input near
x767/z150. It did not clear Air. Inspection of its retained private archive
found Unstolen Hours at2/30, not the earlier live observation of1/30; level100,
XP245125, Gold250176, saved4794HP/3453MP. The exact archive hash is registered
for continuation. Its disposable inspection database was removed; the original
archive was retained unchanged. The travel-combat helper clicked projected
enemy coordinates without acquiring the actual hover target, unlike guarded
interaction drivers. It now observes the normal raycast and requires a live
hostile match before basic input, and rechecks before right-clicking.112 scoped
travel/combat/checkpoint checks and lint pass. This is a test-driver correction,
not proof of a production targeting defect; native continuation must confirm
whether it resolves the interruption. No blanket modal dismissal was added.

Execution handoff: corrected Air continuation `earnedair0925b` at e577c533
terminated after20.8minutes on inventory-driver stash capacity planning, not
the previous portal interruption. The last logged hunt counter was5/30; the
actual final archive records6/30, zero claimed hunt reward, Gold268179 and
saved5571HP/4196MP. No death was observed. Its exact hash
`4f3e2ba4e8a711bf2c8850fbeb45119369fc430880129a4c2c9bbf45cc67f29d` is registered;
the private original remains unchanged. The disposable inspection database was
removed. A99/100-slot stash could not accept the two planned gear items, but
fourteen carried gem/material stacks fit existing stacks without allocating
another slot. Storage planning now consolidates those first, and preflight
checks the actual merged occupancy, not one new slot per deposit.29 inventory
checks plus98 checkpoint checks and scoped lint pass. No rare gear, quest item
or crafting valuable is sold/deleted, and native confirmation is still pending.

An independent prepared-party batch has started after Air cleanup: Water, Fire,
Air crystal raids (five players), then Umbral
Nexus (four players). It runs one browser expedition at a time and stops on its
first failure, with no automatic retry. Logs and separate frozen source trees
are under `/tmp/eidolon-remaining-encounters-20260925-YMvJXK`; Air is under
`/tmp/eidolon-air-continue-20260925-r2-nZLqoQ`. Luna monitors terminal outcomes.
These checks are pending, not completed earned campaign gates. The Nexus party
uses the legal level100 Rare+4 endgame profile; elemental parties retain the
accepted class-affixed Uncommon/Rare profile. Existing accepted finale and other
dungeon evidence are not replayed.

Further reviewed phone polish: the inspected Chronicle notification still
ellipsized its victory title. Phone callouts now wrap the full title while
ordinary enemy target cards retain their compact single-line treatment.14
focused lifetime/style tests and lint pass. The updated native presentation
check passed all three desktop/portrait/landscape cases at dad61f02 in23.2seconds;
the portrait screenshot was inspected and shows the complete title on two lines.
This local change is not in the expeditions' frozen e577c533 source and is not
yet deployed.

Water batch result (`finalwater0925a`): failed after39.2minutes at the aggregate
15-minute repair-event watchdog. The complete combat route and Tidebound Tyrant
were cleared; all five survived and observed waves1/2 cleared and wave3 started.
The last observed Frost Guardian was still being fought/defeated, not a stationary
objective loop. Five-client rendering measured5–23FPS. No restoration/reward
acceptance is claimed. The prepared batch stopped before Fire/Air/Nexus. Its
private archive is `/tmp/eidolon-party-checkpoint-finalwater0925a-PU7EJK/save.archive.gz`,
SHA022313eb6afdfeed780d8ab3e1ccb86af9780e14823bd5c4a659498d405d5091.
The repair-event harness now allows30minutes for24 attackers and three ritual
tasks, still inside the same nonrenewing two-hour expedition budget and existing
per-enemy watchdogs. Death, all-wave, ritual, personal reward and persistence
assertions are unchanged; this does not nerf production encounters or establish
human completion timing. Final artifacts now also retain the crystal snapshot.
The corrected Air inventory continuation `earnedair0925c` at3f161403 completed
the30-kill Unstolen Hours hunt, manually claimed800Gold/117093Resonance XP and
verified checkpoint/relogin, with zero deaths and seven rest stops. Actual stack
merging passed exact item conservation without allocating new stash slots.
The run then reached Feathers of Captured Thunder1/8 before stopping at a genuinely
full stash (projected102items/100capacity), after about1.3hours. No Air readiness
or Tempest clear is claimed. Its registered exact archive
`/tmp/eidolon-party-checkpoint-earnedair0925c-HCVnUL/save.archive.gz` has SHA
231bdca909468078911bc81a843c65168d21bb80dea2fa4b71d7b1b74aba02c1,
level100/245125XP/341739Gold and saved5461HP/4680MP. The temporary inspection
database was removed and the original save retained unchanged.

The inventory driver no longer hoards every Rare forever: after ordinary spare
gear, it may sell only needed unmodified Rares at least ten levels below every
compatible worn slot and strictly worse by the same class score used for normal
equip decisions. Invested gear, sets/unique effects, unknown stats, future gear,
Epic+ items and quest/crafting items are preserved. On the actual save, ordinary
merchant sales of the obsolete level30 girdle/gloves can release the needed
space; no stash deletion, capacity increase or production auto-sell is added.
167 inventory/equipment/checkpoint checks and scoped lint pass. Native sale
confirmation remains pending; the completed30-kill chapter must not be replayed.
The corrected Water/Fire/Air/Nexus batch at be571c6e stopped on Water before
the guardian, after13.4minutes; all five were alive. Its formation planner
repeatedly proposed a path using rounded replicated ally coordinates, then
rejected it against more precise own-client coordinates. The recorded snapshot
reproduces `clearRemote=true / clearActual=false` for the second healer's path;
this is a QA reservation disagreement, not proof of impassable production terrain.
Planning now receives the same observed party positions as reservations, while
other actors, floor checks, clearance and the original15-second formation bound
remain intact.64 focused control checks pass, including the exact failed positions
reaching formation through checked moves. Native confirmation remains pending.
Fire/Air/Nexus did not start; logs remain under
`/tmp/eidolon-remaining-encounters-20260925-r2-xSKvUh`. Its private Water archive
is `/tmp/eidolon-party-checkpoint-finalwater0925b-1F7v0E/save.archive.gz`, SHA
57b9f6a70b2107b894b100f955983110126c39f75a59fec799dbd8cdd54f4249.
Air collection continuation `earnedair0925d` at4f640e2a has started after that
cleanup, preserving the claimed hunt and carried pinion; it remains pending.

September 24: user requires the remaining failures to be resolved, not handed
off as completed work. A separate endgame encounter fixture now prepares all
14 role-affixed Rare items at +4 using normal paid Forge transactions, and
allocates exactly 20 legal class talent points through normal unlock rules.
The prior mixed Uncommon/Rare +0, five-talent-point fixture remains unchanged.
This is prepared encounter QA, not earned progression. Survival, four-phase,
manual turn-in and persistence assertions remain intact. Fixture validation passed in Go and
49 focused JavaScript checks. No additional boss damage or health change.

The prepared endgame run `endgameking0924a` at `bafe485b` defeated the Dark King
with all five characters alive and all four ordered Eidolon callouts verified.
Combat took269.341seconds (4m29s), slightly below the requested5–10minute target;
one automated result is not a precise human balance measurement. The Fighter
manually claimed the finale and saw the epilogue. The next character's Ilyra
window did not open: its failure context still displayed “Move closer.” The
overall run failed, so five-player turn-in/relogin acceptance remains open.
Owned services were cleaned up and the actual private save retained.

September25: the Ilyra test driver was issuing subsequent ground clicks before
the previous movement and camera finished, and could fall through its step
limit without proving interaction range. It now settles each step, uses normal
move-only input through party crowds and requires the live NPC's actual range.
35 focused fixture/approach checks and scoped lint passed. Native confirmation
is still required; this is a test-driver correction, not a proven production
quest-reward fix. Added ground-projection diagnostics and failure screenshots
will distinguish the remaining Air input interruption from server movement.
The retained `earnedair0923a` archive was inspected in a disposable, network-
isolated database (then removed; original archive retained). Its actual Wizard
has the Weatherkeeper investigation claimed and Unstolen Hours accepted at0/30,
level100/245125XP/234181Gold and saved5065HP/3265MP. That exact hash and state
are now registered for continuation, with96 checkpoint checks passing; no Air
completion, healing, logout refresh or missing quest credit was manufactured.

The affected `finalturnin0925a` rerun stopped during combat on an obstructed
Wizard movement step (0.483m observed versus1m required), before testing town
turn-in. All five remained alive; do not count this as a boss clear or an Ilyra
regression result. Its services were cleaned up. To avoid repeating accepted
combat for a town interaction, `finale-turn-in` now restores the checksum-pinned
actual `endgameking0924a` survivor saves into new disposable accounts. Only the
account save-key names change. Exact original Gold, XP, Resonance and personal
claim states are checked before normal UI turn-ins and relogin. This validates
the saved continuation, not an uninterrupted whole campaign or a fresh kill.
Native execution remains pending; lint, test discovery and shell syntax passed.
First saved continuation verified the Fighter's existing claim without paying
again, then the Cleric's actual5000Gold/490250Resonance claim and exact relogin
receipt. It failed only while reopening Ilyra after that Cleric relogin
(`finale-saved-turn-in.spec.js:101`), not at its initial claim. A screenshot
shows Ilyra present shortly afterward. The driver now waits for streamed NPC
readiness using the same active-cache/remote lookup as real projection. The
remaining three characters and that final reopening still require confirmation.

- Focused Forge Go/client/live-refresh tests passed. Full normal-bag transaction
  probes now require every potency step to be payable and charge its exact quote.
- Full Go run completed with two stale audit expectations failing after the
  intentional boss/daily rebalance; those expectations were corrected. Affected
  race checks passed (game35.934s); final `go test ./...` passed all packages
  (game308.210s on the shared host).
- Release/Forge packaging:306 checks passed in4 suites (9.024s). Full lint,
  client preparation and deploy-script syntax checks passed.
- Full JavaScript suite passed:480 suites /7,341 tests (319.163s). Subsequent
  version-history assertions passed281 checks, including the new1.10 note.
- First prepared five-player Dark King test failed when the Rogue died after
  239.1seconds combat. The party dealt approximately298k damage but remained in
  phase one of a1.824M-HP encounter. The mandatory Mythic scaling compounded
  the family health multiplier. New encounters now use570k HP (family2.5x,
  down from8x), targeting5–10minutes at observed throughput. Damage, mechanics,
  survival assertions and gear are unchanged. An affected rerun is required;
  the failure is not counted as a clear. Host contention limits timing claims.
  **Affected rerun completed, still failed:**570k→221,501HP in246.2seconds;
  Rogue died. Embedded report evidence confirms all five clients received and
  rendered phasesI,II,III alive (only phaseI happened to be screenshot-captured).
  Do not infer missing phases from screenshot filenames. Tank mana was nearly
  exhausted; secondary healer was casting with available mana/cooldown and the
  Rogue died during incoming bursts. This is not proof of a progression gate
  failure or a successful clear. No further damage nerf, fabricated victory or
  weakened survival assertion was used. Full finale acceptance remains open.
  Focused Dark King/enemy race checks passed15.966s;294 release/phase-evidence
  JavaScript checks passed after the change. Both owned raid runs cleaned up.
  Finale uses legal class-specific Uncommon/Rare gear and normal player inputs;
  prepared prerequisites are **not** an earned campaign completion.
- Retain accepted four-player Verdant/Abyssal/Molten work, five-player Rootheart,
  public event, casino/admin/arena/social, bounded load, High/Low rendering and
  schema recovery evidence in the linked integration reports. No blanket rerun
  for labels or documentation. Exact scopes/limitations remain in those reports.
- Latest Air earned continuation completed its first investigation but stopped
  during travel with **no pointer input available**. It did not prove a blocked
  server movement command, complete Air, or clear Tempest. Private progress was
  retained; its partial save must not be promoted to a completed handoff.
- Full uninterrupted campaign, remaining regional raid browser clears and
  physical-phone party/dungeon play remain unverified. The user deferred phone
  feedback as nonblocking. Do not advertise these checks as completed.

## Delivery

Prior release1639fd6f /Alpha1.9.31 passed CI35835009087, including native live
character QA. A subsequent public reachability check found both game domains
following eserver.ddnsfree.com to174.220.28.213 while this origin reported
47.203.222.61. Local HTTPS with correct SNI/certificate validation still serves
the exact healthy1.9.31 release. The user has been asked to correct DDNS.
Direct HTTPS to47.203.222.61 with the real hostname/SNI also returns that exact
healthy release with certificate validation and no proxy. The DDNS AAAA points
to2600:1006:b0a6:8dae:98a3:50eb:5675:8757, while this host has only a private
ULA IPv6 address. Correct the A record and remove the stale public AAAA unless
a working routed IPv6 origin is deliberately configured. No nginx change is
needed to address the demonstrated DNS mismatch.

**September 24: Alpha 1.10.0 is verified live.** CI35909760534 passed all ten
jobs for e67fc0ad1b924002758e67e5a3a3bcb615d97476, including live character and
town recovery checks. After the user corrected IPv4 DDNS, the public verifier
confirmed both release identities, database readiness, login label, cumulative
notes and three exact published assets without an origin override. Do not poll
that completed CI again. The public AAAA belongs to another machine running the
Windows DDNS updater; the user explicitly deferred DNS/IPv6 changes. IPv4 works,
but public IPv6 service remains unverified. Deployment success does not close the failed encounter
checks above. No production grants or billing changes were made.
