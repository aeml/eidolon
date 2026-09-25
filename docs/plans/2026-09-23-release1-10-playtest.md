# Alpha 1.10.0 — The Resonant Age playtest

User direction: finish the integrated work to the best of our ability, test it,
and deploy 1.10 for playtesting. This record supersedes older *current status*
paragraphs, not their retained test evidence. It does not equate implemented
features, automated checks and a complete human campaign playthrough.

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
focused lifetime/style tests and lint pass. The existing native presentation
case now checks unclipped title bounds and also covers landscape; that updated
browser check must run after the queued expeditions release the GPU. This local
change is not in their frozen e577c533 source and is not yet deployed.

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
