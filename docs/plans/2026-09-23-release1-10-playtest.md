# Alpha 1.10.0 — The Resonant Age playtest

User direction: finish the integrated work to the best of our ability, test it,
and deploy 1.10 for playtesting. This record supersedes older *current status*
paragraphs, not their retained test evidence. It does not equate implemented
features, automated checks and a complete human campaign playthrough.

## Current handoff — September 26

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
