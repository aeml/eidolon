# Earned campaign continuation with a real party

## Water readiness accepted — next: earned four-player Abyssal

`earnedwaterregion0920f` passed in14.8m, native2051 exit0, frozen clean
15697bcb, under `/tmp/eidolon-water-region-resume-20260920-r6-oEt2Bn/`.
The nine remaining kills reached70/70 with no deaths; manual reward, relogin,
saved Water completion and accepted Normal60 Abyssal handoff passed. Owned
gameplay containers are gone. Independent network-isolated Mongo restore confirms
Wizard83/90198XP/104319Gold, resources3663HP/2816MP/alive, all Water chapters
completed, hunt reward550Gold/54750XP, Abyssal accepted0/1 with no reward, and
no accepted/completed dailies. Full private archive:
`/tmp/eidolon-party-checkpoint-earnedwaterregion0920f-uMKyrl/save.archive.gz`,
SHA256`80ed91fd1520a1dd51aff44f17112c0456f4ef341460ad932721f561d7c38ae5`.
The temporary inspection copy is removed; original archive is retained.

The existing checkpoint catalog now pins that full save and its exact dungeon
handoff; earlier partial saves still reject premature dungeon offers.78 focused
checkpoint/party-fixture tests pass1.505s, plus lint/diff. Next use the existing
earned-party-dungeon route for Normal60 Abyssal: this earned Wizard plus prepared
class-appropriate Rare/Uncommon Fighter, Cleric and Rogue. Do not replay accepted
Water or earlier Earth/Verdant. The Wizard's many incidental defensive kills
remain a pacing limitation, not evidence of a clean normal story-level curve.
Full Abyssal, later regions/raids and final1.10 remain unverified.

The next stage is now running: `earnedabyssal0920a`, native56558, frozen clean
47e0adec, launcher/log `/tmp/eidolon-earned-abyssal-20260920-r1-MGXN8s/`.
Normal60, Low graphics, existing two-hour party bound and zero retries; Luna
monitors terminal-only. No deployment browser job or other native route overlaps.
This launch is not evidence of a dungeon clear.

Fire/Air continuation preparation reuses the Water route's existing walking,
investigation, hunt, collection, manual turn-in and saved-handoff helpers with
authored regional selections. `earned-region` plus `EIDOLON_E2E_STORY_REALM=fire`
or `air` retains the same isolated archive capture, two-hour ceiling and zero
retries. It requires an actually completed preceding dungeon; no checkpoint for
that future success is invented. Collection/hunt receipts now check the full
XP-plus-Resonance amount and cap-only split instead of incorrectly demanding
ordinary XP at level100.47 focused JS tests pass3.035s, actual Go quest cap/overflow
tests pass1.045s, and lint/shell syntax/diff pass. These are QA preparation only,
not Fire/Air completion or a new player-facing release; active Abyssal stays on
its original frozen source.

## Previous retained progress — hunt61/70, bag-policy failure

Native7513 / `earnedwaterregion0920e`, frozenaa71420e, ended exit1 after1.1h.
Ordinary dead-save respawn and defended transit worked; no new hunt deaths.
The failure was an artificial bag policy: after normal sales there were six
free slots and only one spare gear item, so the gear-only planner could not
reach its eight-slot buffer. The other carried items were mostly gem stacks,
57 Eidolon Shards and19 Eidolon Hearts. Gameplay already permits their storage.

The planner now preserves spare gear first, then banks gems/materials/relics
through normal stash clicks. Quest items and consumables remain carried; these
valuables are never sold or discarded. Exact stack-merge/overflow predictions
check source removal, destination identity/metadata/quantity and unchanged
Gold/equipment/quest state. Existing buffer and capacity bounds remain intact.
The server's existing stash conservation tests pass0.338s. No gameplay, drop,
currency or storage-capacity change is introduced.

Independent isolated Mongo restore confirms the actual full private archive:
`/tmp/eidolon-party-checkpoint-earnedwaterregion0920e-MpomTx/save.archive.gz`,
SHA256`1bcc55dbffdd271ce8abd909480dd142e5b754378c6e8dcf5ca95d239a9928c4`.
Wizard80/87276XP/98595Gold, Golem61/70 unclaimed, all prior Water rewards retained,
no Abyssal offer or accepted dailies, saved health3415/mana2766/alive. The full
inventory/stash is preserved, not reconstructed from a gear fixture. Temporary
inspection copy removed; original intact. Resume nine remaining kills, not the
earlier31-kill checkpoint. The route's many incidental defensive kills mean its
level80 is not a clean story-only pace/balance benchmark.

## Latest terminal result — undefended transit, saved hunt31/70

Corrected continuation `earnedwaterregion0920e` is launched in native7513,
frozen clean aa71420e, under
`/tmp/eidolon-water-region-resume-20260920-r5-pRVHtr/`. Prior owned cleanup and
idle deployment GPU queue were checked. Luna monitors; no new accepted clear yet.

Native46156 / `earnedwaterregion0920d` ended exit1 after23.6m at the third death,
not a timer failure. All owned services are gone. Its repeated death observations
show roughly14 Mountain Trolls around the Wizard nearZ-960, with1940–2005 mana
still available. Local Golem search moved through Troll territory without calling
the existing defensive combat controller. The regular combat loop did defend,
but was not reached until a suitable visible Golem was found. No game balance,
spawn or damage correction is inferred from this automation failure.

Future search now invokes the existing bounded approach-combat routine before
another transit stride, reusing the current class controller rather than resetting
cast observations. Wizard crowd control uses already-unlocked/affordable hotbar
skills. Existing160-cycle local defense,100-step search, combat deadline,
two-respawn bound and overall two-hour ceiling remain. No character grants or
enemy changes.119 focused tests pass1.469s, plus lint/diff. Connected confirmation
is still required; the previous native run was not changed or restarted in place.

Independent isolated Mongo restore confirms the newer full archive
`/tmp/eidolon-party-checkpoint-earnedwaterregion0920d-eLnn4N/save.archive.gz`,
SHA256`24094f09eb741015a20288c3530569349432628ae8ede8e1afe7da2aaafb2624`:
Wizard62/40713XP/53469Gold, Golem31/70 unclaimed, prior Water rewards intact,
no Abyssal offer or accepted dailies, resources version1/health0/mana2005/deadtrue.
The checksum catalog explicitly preserves that death snapshot. A continuation
uses the ordinary respawn button after login, not a healed replacement save.
The temporary inspection copy was removed; the private archive remains intact.
Next continuation must retain these31 kills, leaving39, and all three recorded
deaths remain part of the campaign evidence.

## Latest retained Water save — level62, hunt28/70

Corrected continuation `earnedwaterregion0920d` is launched in native46156,
frozen clean1970e75b. Launcher/log/source:
`/tmp/eidolon-water-region-resume-20260920-r4-sexyuG/`. It starts only after
accepted1.9.25 delivery and prior owned cleanup; Luna monitors the bounded run.
93 focused checkpoint/recovery/search tests pass1.632s, plus lint/diff checks.
This launch is not a connected pass; no repeated deployment or completed quests.

While that frozen run remains active, repeated `ground-pointer-intercepted`
receipts show its regional waypoint clicks sometimes selecting roaming Skeletons
instead of ground. The main worktree's future waypoint travel now requests the
existing move-only Shift-click gesture, preserving collision and the existing
ordinary jump fallback. No live test/source change or claimed pacing gain.
55 focused movement/route/reading tests pass6.598s, plus lint/diff. This is a
QA-input correction, not a player combat change or a reason to restart46156.

`earnedwaterregion0920c`, frozen0a104720, native47339 ended exit1 after12.7m.
Stash preparation passed. The failure was target search at the inner encounter
deadline after a real110.083-second unfinished-hunt town recovery. That trip
consumed nearly the entire120-second combat window; the subsequent bounded
search failed before returning to the Golem band. This does not establish a
missing spawn, broken ability or balance defect. No deaths were reported.

The QA clock now excludes only measured successful Recall/healing/departure
time from its120-second combat allowance, preserving time already spent fighting.
It does not reset the combat window, skip recovery, grant progress, change game
rules or increase the overall two-hour expedition ceiling. This deliberately
replaces the former wall-clock encounter policy, which conflicted with the
required town-rest loop. Failed recovery still fails; ordinary target search
remains bounded. The correction is local and awaits connected confirmation.

Independent network-isolated Mongo restore confirms the actual private archive:
`/tmp/eidolon-party-checkpoint-earnedwaterregion0920c-bVQmMA/save.archive.gz`,
SHA256`66b9238c0b35b9b10720885664197079eda0418c24971542b112955d39493e2f`.
Wizard62/7668XP/51749Gold, Golem28/70 unclaimed, all previous Water chapter rewards
retained, no Abyssal offer or accepted dailies. The checksum-pinned continuation
catalog now retains this whole save; resume42 kills, not25/70 or earlier chapters.
The temporary inspection database was removed; the private original is intact.
Run reports/log remain under `/tmp/eidolon-water-region-resume-20260920-r3-mNBwzz/`;
owned gameplay containers are gone. Full Water/Abyssal remains unaccepted.

## Queued retained-save continuation after the stash correction

Native session 47339 waits on CI35503417369 (release1.9.25, immutable
`0a104720cad83d2314534ec042920ee0236207ad`), then independently verifies public
delivery before starting `earnedwaterregion0920c`. Launcher/log and frozen source:
`/tmp/eidolon-water-region-resume-20260920-r3-mNBwzz/`. Luna monitors terminal
outcomes. No native gameplay overlaps deployment QA. The corrected stash path
passed desktop/portrait/landscape in23.4s; see the stash approach report.

Resume the checksum-pinned level61 full save below:25/70 Golems, remaining45
kills and manual handoff. Do not replay completed chapters or manufacture gear,
XP, rewards or logout times. Existing two-hour limit and zero retries remain.
This is a queued run, not a completed Water/Abyssal acceptance.

## Water partial save retained — level61, final hunt25/70

The retained-save continuation ended exit1 under native58053, runID
`earnedwaterregion0920b`, frozen clean534da08b in
`/tmp/eidolon-water-region-resume-20260920-Azedqr/source`. Launcher/log live in
its parent directory. All CI35500889856 jobs passed at09:19:12UTC, followed by its
independent `PUBLIC_RELEASE_VERIFIED` for exact publicd1e707e3/Alpha1.9.24,
readiness and casino assets. It failed after48.8s while opening storage during
preparation, before any new Water kills. Actual archive restore confirms the
same61/21946XP/51012Gold and25/70 Golem credit. The archive is
`/tmp/eidolon-party-checkpoint-earnedwaterregion0920b-5gXoFb/save.archive.gz`,
SHAdd1862a3df0ae4cdf8a7f477494e4439ce2643fa4c20719f80eb722e7cdacc14.
Both owned services are gone. See [stash approach](2026-09-20-stash-approach.md)
for the proved blocked centre path and local gameplay correction. Verify that
short path before another continuation; do not replay completed Water chapters.

`earnedwaterregion0920a` ended exit1 after1.7h, with terminal phase
`earned_water_region`. Its owned API/Mongo containers are gone. Independent
isolated archive restore confirms level61/21946XP/51012Gold, completed shelter
ledger1/1, Troll hunt60/60, Pearls8/8 and reflections3/3, then accepted but
uncompleted Aqua Golem hunt25/70 with no granted reward. No Abyssal offer or
accepted daily quests exist. This is partial campaign evidence, not Water or
Abyssal acceptance. Source/reports/log remain at the directory below.

Private full archive:
`/tmp/eidolon-party-checkpoint-earnedwaterregion0920a-VKwGpk/save.archive.gz`, SHA256
`ebf5969b1e122e7931fd2f7fd0d1b2112c81f619b3e027b93e6830613405b1a0`.
The continuation catalog now pins these actual fields, all four chapter rewards,
and the unclaimed hunt. Existing earlier-checkpoint guards remain unchanged.
Only the account save key is remapped; no items, credit, resources or time are
manufactured. Resume the remaining45 kills and manual handoff, not prior chapters.

The retained log records one death at25 kills, successful authoritative full
HP/mana town respawn, then local target search attempting a direct northward walk
through town (188.03→187.525Z; blocked target0,181). Unlike rest/training recovery,
the hunt driver's death branch omitted its supplied regional `leaveTown` route.
That QA-only branch now uses the same ordinary waypoints after respawn. Do not
relax movement assertions or change collision on this evidence. No new connected
resume result is claimed. An earlier status describing the run as having no
deaths was only true of the interim sample, not this terminal result.

The queued1.9.24 casino release published exactd1e707e3 after owned Water cleanup;
these continuation changes remain separate from that immutable release. Avoid
overlapping its native deployment QA with another gameplay run.

60 focused checkpoint/continuation tests pass in1.151s, with changed-file lint
and whitespace checks. The temporary network-isolated Mongo used to inspect the
archive was removed; the original owner-only archive remains intact. The route
recovery change is statically reviewed/linted, not yet a connected respawn pass.

## Historical launch and interim observations after1.9.23 delivery

Parent15946 passed CI35494967147 and independent public acceptance
of1eb18f59/Alpha1.9.23, and its Water gameplay process is live. Launcher/log directory:
`/tmp/eidolon-water-region-20260920-D2U8te/`. Source is frozen clean1eb18f59 in
its `source/` worktree; do not edit or overlap native browser work. Luna monitors
the guarded sequence. `WATER_TERMINAL_PHASE`/`WATER_PROCESS_EXIT` distinguish
deployment/public/source failure from the later `earned_water_region` phase.

After those gates, `earnedwaterregion0920a` uses the accepted level43 full save
below for the shelter ledger,60 Trolls,8 Pearls, three echo-pool/bell discoveries,
70 Aqua Golems and actual level60 Abyssal readiness. The original two-hour ceiling,
zero retries, normal recovery/training and manual claims remain. A below-gate
result must preserve actual progress for pacing review, not fabricate XP or
mandate dailies. The region is running, not accepted; do not replay Missing Ferry.

Current retained log reaches Wizard59 with no deaths and20/70 Aqua Golem credit.
That hunt's20-kill sample spans1512s and10 town stops, with recent recovery trips
taking76–87s. This is a conservative automated expedition, not a final human
pacing baseline: the route uses an80% health retreat threshold. Do not change
rewards, stats or regeneration from these timings alone. Shared automatic level
growth explains the observed base stats; this is not a fixture spending Wizard
points into Strength. No running source or character was modified.

Local QA-only continuation preparation (not part of the queued1.9.24 release):
the Water route now retains completed chapters and explicitly resumes accepted
hunts, collections and investigations. Ready objectives still require manual
Ilyra completion; no count/reward/time rewriting. It can retain an already
accepted Abyssal offer, but rejects an already-completed dungeon. State checks
reject inconsistent saves.26 focused continuation/handoff tests pass1.828s;
focused lint and whitespace checks pass. This is not connected resume evidence.
The archive allowlist remains unchanged: after the current run ends, inspect
and checksum-pin its actual saved progress before attempting a continuation.
Never infer a persisted save from the live log or repeat the whole Water region
solely because the bounded test did not finish.

## Missing Ferry accepted — saved level43 investigation handoff

`earnedwater0920b`, clean5c42b4dd, native40858 finished **exit0/PASS** in2.2m.
It resumed the actual58-kill save, earned only the remaining two kills, manually
claimed400Gold/28593XP from Ilyra, reconnected and verified the saved next offer.
Actual Mongo and independent archive restore agree:43/35906XP/27416Gold,
Ferry60/60 completed and Flood Shelter offered but unaccepted at0/1; no dailies.
Full-character transfer into a new disposable account also passes exact equality.

The new private full save is
`/tmp/eidolon-party-checkpoint-earnedwater0920b-pJGXDS/save.archive.gz`, SHA256
`e6a43eaf1a70cb8e681ef7a14e1a0e0125b91e4b22b294b642c376807887055e`.
The catalog pins its exact reward and fresh investigation fields.32 focused
checkpoint checks pass in0.605s, with lint/diff checks. Reports/results and log
are preserved under `/tmp/eidolon-water-finish-20260920-tWOp4t/`; owned services
and the disposable verification container are gone.

Use this save for `earned-water-region` after the pending1.9.23 delivery clears.
Do not repeat Missing Ferry, Earth or Verdant. Remaining Water investigations,
hunts/collection, level60 readiness and the full Abyssal party clear are open.
The earlier partial-run and launch descriptions below are historical.

## Missing Ferry partial save retained —58/60, no repeat required

Follow-up `earnedwater0920b` launched under native40858, with launcher/log
`/tmp/eidolon-water-finish-20260920-tWOp4t/run.log`. Its frozen detached source
is clean5c42b4dd at that directory's `source/`; browser dependencies are prepared.
It restores the exact58-kill archive below, keeps the30-minute/no-retry bounds,
and requires the remaining two ordinary kills, manual claim and saved offer.
Luna reported its terminal success, accepted above. Its frozen-source and
no-overlapping-browser safeguards applied throughout the run.

`earnedwater0920a` ended exit1 after30.0m on frozen29ef2862. Native45531 and
`WATER_TERMINAL_PHASE=earned_water`/`WATER_PROCESS_EXIT=1` agree. All owned
services are gone; copied reports/results and log are retained under
`/tmp/eidolon-earned-water-20260920-MuBmtK/`. No full Water acceptance is claimed.

The reported failure is a six-unit retreat assertion, with4.32units observed;
the final diagnostic still shows MOVING, no stun/root/freeze, and5.28units of
eventual displacement. The report marks failed at1,799,762ms, near the whole-
test30-minute ceiling. This does not establish a new gameplay collision defect
or prove that the whole-test deadline caused it. Do not weaken movement/combat
bounds or alter runtime movement on this evidence alone.

Actual isolated archive restore confirms Wizard42/32261XP/25427Gold,
Missing Ferry accepted58/60 but incomplete with no granted reward, completed
Verdant1/1 and Earth Orc50/50, no Flood Shelter offer and no accepted dailies.
Private archive:
`/tmp/eidolon-party-checkpoint-earnedwater0920a-1o15d8/save.archive.gz`, SHA256
`c65ddaee9a989f47289b9db2fbc98842746871d5fea84df2e1dd1248382b45a1`.
The checkpoint catalog pins these exact fields. Real mongosh full-character
copy into a disposable account passes the exact equality guard;39 focused
checkpoint/continuation tests pass in0.849s, plus lint/diff checks. The isolated
verification container was removed; original archive remains private and intact.

Resume only the two remaining kills and manual turn-in using the prepared
partial-hunt route, then verify the saved investigation offer. Do not replay
the58 kills, Earth or Verdant. Alpha1.9.23 is locally packaged but not published;
complete this short continuation before invoking its native deployment QA.

## Earned Wizard Verdant completion accepted

`earnedparty0920c`, clean3b163421, native63326 is terminal **exit0/PASS** in46.7m.
The original full four-player Normal30 route passed: all bosses/rooms, no deaths,
four ordinary town-rest returns preserving the instance and progression, four
individual manual claims, fresh Water offers and relogin persistence. Effective
Cleric ally healing was9,218HP. The Wizard kept its actual earned equipment;
Fighter/Cleric/Rogue used the approved prepared class-appropriate gear. This is
earned Wizard progression with prepared support, not four earned characters.

Reports/results and boss screenshots are preserved in
`/tmp/eidolon-earned-party-20260920-r3-2CzUJB/`; owned services are gone.
The Wizard's actual saved-Mongo assertion passed before cleanup. Independent
isolated archive restore confirms level33/23108XP/10598Gold, completed dungeon
1/1 and Missing Ferry offered but unaccepted at0/60. Entry was31/12448XP/9047Gold.
The new complete private archive, not a build-only fixture, is:
`/tmp/eidolon-party-checkpoint-earnedparty0920c-9grSBR/save.archive.gz`, SHA256
`8b075ebdac1f5fea3b7849927dfd3679b6b2e70d3dfb1dd908961dbc9c31e741`.
Use this checkpoint for Water. Do not replay accepted Earth/Verdant work.

### Next continuation prepared — Missing Ferry

The main-tree continuation now compares initial browser progression with the
checksum-verified saved Mongo state rather than hardcoding33/23108/10598. It
can resume an already accepted hunt, perform the remaining ordinary kills and
manual claim, or verify an already completed handoff without claiming twice.
The existing30-minute bound and current frozen run are unchanged. This does not
authorize arbitrary saves: any new partial/completed archive must first be
inspected and explicitly checksum-pinned with its actual earned fields. The
catalog currently still permits only the previously verified archives. Changed-
file lint, discovery and diff checks pass; no continuation has been restarted.

Deployment gate cleared at06:00UTC: all CI35492191742 jobs passed, followed by
the independent `PUBLIC_RELEASE_VERIFIED` receipt for4f39328b/Alpha1.9.22.
Parent45531 then passed its frozen-source guard and entered isolated setup for
`earnedwater0920a`. This is an active continuation, not a completed Water quest.
The build identity carries `-dirty` because of the pre-existing untracked
`verify-checkpoint.mjs`; tracked source remains clean29ef2862. Do not alter it
mid-run. The original queued-launch description below records its safeguards.

Guarded continuation queued September20: native45531, run`earnedwater0920a`,
launcher/log `/tmp/eidolon-earned-water-20260920-MuBmtK/`. The script first
requires corrected publishing CI35492191742 success, then independently checks
exact public client/server4f39328b/Alpha1.9.22, database readiness, login label,
cumulative notes and shipped party CSS/JS. Only then may gameplay start from
frozen detached source29ef2862 in
`/tmp/eidolon-earned-continuation-20260920-0VmRVz`. Luna watches terminal status;
`WATER_TERMINAL_PHASE` distinguishes deployment/verification failure from actual
gameplay, and `WATER_PROCESS_EXIT` confirms termination. Initial handle is live,
but no deployment verification or Water gameplay result is claimed yet. Do not
edit that worktree or launch competing native browser work while queued/running.

The checksum-pinned level33 archive is now supported by the existing full-save
transfer. It additionally requires completed Verdant and a fresh, unaccepted
Missing Ferry offer before copying. Actual isolated Mongo restore, exact whole-
character transfer and the saved-progress reader pass; no equipment, resources,
rewards or logout time is synthesized.17 checkpoint tests and15 isolation/cleanup
checks pass; lint, shell syntax, test discovery and diff checks pass.

`EIDOLON_ISOLATED_QA_ROUTE=earned-water-resume` runs the next bounded story
chapter from that save:60 ordinary level40+ Construct kills in western Earth,
normal recovery/training, manual Ilyra turn-in, relogin and actual saved-Mongo
XP/Gold/quest checks including the fresh flood-shelter investigation offer.
Its cleanup preserves a complete private archive on success or failure. This
route is now starting, **not yet accepted**. Use the archive path above;
do not overlap with deployment browser work or a later Fire raid. It is
not a full Water-region or four-earned-character pacing claim.

### Remaining Water region route prepared independently

Main-worktree preparation now adds `earned-water-region`, starting only after
Missing Ferry is completed in a checksum-pinned earned save. It uses the existing
ordinary realm waypoints, investigation reading/combat and manual Ilyra replies:
shelter ledger →60 Trolls →8 Moon-Tide Pearls →three echo-pool/bell discoveries
→70 Aqua Golems →accepted level60 Abyssal Well chapter. Existing earned equipment
comparison/training, recovery and inventory management are reused. The collection
driver now takes explicit quest/item/enemy parameters; Earth defaults, death and
encounter bounds, server credit and manual item consumption remain unchanged.

The final route checks all five completed chapters after relogin and in actual
Mongo, plus XP/Gold and an uncompleted dungeon handoff. A below-level60 result
must retain the actual save and inform pacing review; it is not permission for
daily substitution, fabricated XP or an easier dungeon gate. Additional ordinary
leveling time may need measurement before drawing a balance conclusion.

62 focused collection/recovery/cleanup checks pass in1.123s, lint/Bash/diff and
Playwright discovery pass. A direct Node import/read check confirms exact Pearl
vs Seed inventory counting without mutation. These are preparation checks, not
connected Water acceptance. The queued Missing Ferry worktree remains frozen and
unchanged. After it succeeds, inspect its new full archive, pin the actual SHA
and saved progress in the checkpoint catalog, then run this continuation; the
older level33 archive intentionally fails its completed-Ferry precondition.

### Abyssal party continuation prepared — not yet run

The existing `earned-party-dungeon` route now also accepts explicit
`EIDOLON_E2E_DUNGEON=abyssal_well` at Normal60. It restores the earned Wizard
without replacing gear or rewards, requires all seven prior Earth/Water chapters
complete and the dungeon accepted at0/1 in both client and saved Mongo, then
checks ordinary guide access. Fighter, Cleric and Rogue remain level60 prepared
class-appropriate Rare/Uncommon supports. Existing full-room/boss, healing,
survival, four personal claims and reconnect checks remain unchanged. The final
earned receipt now matches the selected chapter, its next offer and actual saved
level/XP/Gold rather than hardcoding Verdant. This does not grant access to raids,
other families or higher difficulties under the earned option.

59 focused continuation/fixture/catalog/checkpoint tests pass in0.923s; changed-
file lint and diff checks pass. No native browser run or deployment was started.
This still requires an actual checksum-pinned post-Water level60-ready archive;
the current level33 checkpoint must fail entry. Preserve the running Missing
Ferry worktree unchanged, finish earned Water pacing first, and use that actual
save for the four-player Abyssal continuation. Do not replay Verdant or turn a
prepared support character into claimed earned campaign evidence.

### Later realm travel preparation

The returning-investigation route still had its own outdated Air waypoints,
crossing the solid Bastion entrance between(500,200) and(900,200). It now reuses
the existing shared path around that footprint, preserving ordinary gates and
collision. The earned hunt search also supports the authored Magma Golem
X-1795..-1405 and Thunder Roc X1805..2195 bands from `world.go`; explicit regional
town-departure paths remain required. No quest eligibility, rewards or runtime
movement changed.23 focused target-selection checks pass in0.618s, plus lint,
diff and investigation test discovery. This prepares later Fire/Air work, not
earned regional acceptance, and does not alter the active Water worktree.

Visual follow-up from the inspected `party-boss-HollowSentinel.png`: the narrow
four-player desktop panel has scrolled its header/tank row out of view while
lower support controls remain visible. The existing HTML-only party layout
fixture checks all health-bar bounds for5/10 members but not the initial4-member
party. The real-HTML reproduction now includes Ready Check before healing
selection: before the fix the header moved to y=-38 above its panel at y=140.
Four-player desktop parties now use a compact two-column roster with fixed
header/health bars and independently scrolling, keyboard-focusable options.
Smaller parties, five-to-ten-member raid layout and the separate phone roster
retain their existing behavior. Both1280x720 and1440x900 fixtures pass (19.6s),
including existing raid/ground-projection checks;60 social/healing unit checks,
lint and diff checks pass. The1280 screenshot was visually inspected. Artifacts:
`/tmp/eidolon-four-party-roster-20260920-XKGFE3/`. This is a verified local
runtime fix, not yet deployed. Include in the next runtime release's patch notes:
“Four-player party health bars stay visible while using ready checks, loot and
invitation controls.” No additional full dungeon replay is needed for this UI fix.

Next-region preparation: commit733621eb merged as7fa57f00 after the run ended.
It extends the existing hunt
search to Water's authored Troll/Aqua Golem bands. Missing Ferry still searches
western Earth; later Water hunts require an explicit ordinary town-departure
callback, reused for recovery.26 focused target/travel tests pass in1.267s;
lint/diff pass. No connected Water acceptance is claimed. Continue from the
newly captured save through actual regional travel and quest gameplay.

`earnedparty0920b` is terminal exit1 after2.8minutes on cleanee9a1ddd.
Native52518 and the log footer confirm termination; reports/results are retained
in `/tmp/eidolon-earned-party-20260920-r2-XoHW0R/`, owned services are gone.
The actual saved-handoff check passed at31/12448XP/9047Gold, and all four entered
the same dungeon. Initial combat passed with everyone alive; a formation check
stopped traversal before the next pull. No full clear or claim is accepted.

The recorded Cleric/Rogue positions were just beyond the five-unit gathering
boundary. The planner offered valid final steps shorter than one unit, but the
new visible-prefix filter rejected them. A focused reproduction using those
exact coordinates, actor collision checks and real projection failed before the
fix. The strict-arrival caller now admits steps down to its0.25unit tolerance;
ordinary displacement-only callers retain the one-unit minimum. The original
five-unit gathering limit,15second deadline and precise arrival checks remain.
The reproduction and81 related tests pass in0.881s; lint/diff pass.
Use the verified pre-dungeon level31 checkpoint for the corrected route; the
failed partial dungeon is not claimed as a successful or resumable clear.
Its private archive is `/tmp/eidolon-party-checkpoint-earnedparty0920b-d4iF9Q/save.archive.gz`,
SHA256`d2354439975cc985bcc0cf83be239b7888d2cfdef2ccd1a4186392f096c0478b`.

## September20 saved-read correction

`earnedparty0920a` is terminal exit1 after3.5minutes, before dungeon entry.
Native35451 and `PARTY_PROCESS_EXIT=1` agree. Results/report are preserved in
`/tmp/eidolon-earned-party-20260920-2zClmS/`; owned services are gone.
The four remaining kills and manual reward **are saved this time**:
Wizard31/12448XP/9047Gold, Orc50/50 completed, dungeon accepted at0/1.
An isolated real Mongo restore confirms these exact fields and the correct
account save key. This is not the earlier unsaved level31 attempt.

The verification reader threw `TypeError: "this" is null or not defined` in
mongosh when optional chaining followed the database call. Separating the
lookup from field access fixes the real reproduction.32 focused isolation,
transfer and cleanup tests pass in1.057s; lint/diff checks pass. The latest full
archive contains prepared teammates too, so the transfer now selects exactly
one Wizard document and still requires its checksum and exact earned fields.
Actual restore/whole-character copy/readback into a new QA account also passes.
No gameplay, rewards, inventory or logout timestamp is synthesized.

New valid private continuation archive:
`/tmp/eidolon-party-checkpoint-earnedparty0920a-JV9eGg/save.archive.gz`, SHA256
`c3cca5c86852d354fc13b3e8f4c48513c5ff083153608866a45c5afdb358c673`.
Use this level31 save next; do not repeat the four kills or manual reward.
Full party dungeon clear and post-claim save remain unproven.

## Earlier continuation record

The September14 Earth readiness result remains accepted. Its private full save
at level30/7170XP/8539Gold, Orc46/50 is retained with verified SHA256
`be0c40ad5c8ff6cc42cb2dbb42e23bb07ad721814959f3f8e518b21ecaeb765c`:
`/tmp/eidolon-earned-earth-r2-20260914-1c1qRm/earned-earth-r2-level30.archive.gz`.
Do not substitute the older build-only JSON fixture or replay the opening.

September20 attempts revealed a disposable-account identity mistake. The first
finished the four kills and claimed level31 in memory, but preserving the old
character name prevented normal saves to the new account. Its Mongo archive is
still level30; a second attempt correctly refused to call it level31. Both runs
are terminal, their reports retained. These are not new saved-readiness passes.

The fix remaps only the character name to the new account's required save key.
Inventory, equipment, currency, XP, quest progress, resources and logout times
remain the original snapshot. Normal Leave Party controls remove the old
account's solo-party association. Real isolated Mongo restore/copy passed;
focused isolation, save-transfer and cleanup checks passed. Readiness must now
match actual saved Mongo level/XP/Gold and quest state, not only a warm reconnect.

The next route is `earned-party-dungeon`: restore the Wizard, finish the four
unsaved kills/manual handoff, verify its saved readiness, then form a normal
four-player party with prepared level30 Fighter, Cleric and Rogue. Those three
retain the approved class-appropriate Rare/Uncommon equipment; the Wizard keeps
only its actual earned build. Complete the full Normal30 Verdant dungeon,
individual manual claims, next Water offer and the Wizard's actual database
receipt. No forced deaths, additional rewards, stat scaling or instance-expiry
changes. This is earned Wizard progression with prepared support, **not** four
independently earned characters or acceptance of the party leveling curve.

Implementation merged asbd96dfe0/b038eb98 after Fire ended. The53 focused
fixture/isolation checks pass in3.405s, lint/Bash/diff checks pass.
`earnedparty0920a` ran on cleanb038eb98, native35451, launcher/log directory
`/tmp/eidolon-earned-party-20260920-2zClmS/`, monitored by Luna. It uses the
original private archive above, Low graphics and zero retries. The wrapper
preserves the final full save. Never overlap it with Fire or deployment browser
QA; it ended with the saved-reader failure described above, not a full clear.
