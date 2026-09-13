# Alpha 1.7.0 — a competitive arena

Separate worktree based on1.6 with correction34c1c0d8 merged. Runtime and package
are now1.7.0, staged for publication AFTER verified1.6 delivery. No1.7live claim.

## Required scope

- Refine actual team-elimination2v2, with clear practice versus ranked queues.
- Rating-aware matchmaking with understandable widening search windows, honest
  queue status, and cancellation/reconnect handling. No fabricated opponents.
- Explicit combat normalization policy visible before entry. Preserve builds and
  ownership, restore real PvE state on exit, and avoid hidden stat scaling.
- Clear team results, rating changes and seasonal rewards with durable, idempotent
  reward settlement. Defend against repeated-opponent farming, intentional losses
  and disconnect/rejoin abuse without punishing innocent teammates as exploiters.
- Package with cumulative notes and synchronized login version, publish and verify
  the exact live release. No invented completed matches or reward receipts.

## Implementation checkpoint — September 13, 03:43 UTC

04:43 state cleanup and packaging: each actor carries an immutable pre-match
return snapshot, copied with GetEntityCopy. Character saves project entry HP/MP
and XYZ/instance from that same detached snapshot, even after live match removal;
arena deaths/refills/temporary instance IDs cannot replace the PvE save. Well
Rested remains its actual bank. Live exit clears the projection and restores entry
resources. Original absolute skill/attack/ability cooldown deadlines return on exit.

Entry and each new round clear transient combat buffs, shields, DoTs, CC, HoTs,
summon/channel state, combo/rune effects and cooldowns, recalculating affected
stats. Round/exit removes only that match's nonplayer combat entities, including
projectiles; unrelated scenes remain. Gear/build/progression/Gold/rest unchanged.
UI explains the policy, with long rules collapsed behind a disclosure so queue
actions remain easy to find. Main/game targeted save/combat/WellRested/arena
checks PASS13.346s+0.196s; the new fixture initially had zero Intelligence/mana
capacity and was corrected to a valid10Int before that pass. New save test round-
trips the real character serialization after removal of its match; no full crash
matrix claimed. Existing build-trimpath-all PASS, UI9PASS0.878s before packaging.

Alpha1.7.0 version synchronized across login/package/lock/release/server/deploy/
CI/QA and current roadmap label, with eight cumulative in-game patch notes.
Version/history checks and final relevant build/lint are being finished. All
required1.7 feature batches now implemented; final live release verification is
still REQUIRED. Full earned season/campaign/recovery matrices remain consolidated
1.10 stabilization. Schema10 compatibility/receipt preservation warning below
still applies; do not roll back to a schema9 writer after1.7 deployment.

Packaging checks now PASS: prepare:client, version/history+UI255tests1.507s,
final disclosure UI9tests0.733s, changedJS lint, versionedGo build-trimpath-all and
diff-check. Candidate may be frozen for ordered publication. 1.6replacement
CI34738051311 is still active, now server/clientPASS and browser shardsrunning.

04:33 seasons batch: eligible ranked victories now track separately from W/L
and old season points. Only unrestricted, non-forfeit ranked wins qualify. End-
quarter medals: Bronze10wins/250Honor; Silver25wins+1200rating/600Honor;
Gold50wins+1500rating/1200Honor. Highest tier only. Qualification begins1.7;
old W/L is retained but not invented as eligible wins retroactively.

On next arena open/entry after UTC quarter end, the DB archives actual prior
season/rating/W/L/eligiblewins/medal/award/settledtime, adds the prize to retained
Honor and resets rating1000/currentseason counters in ONE conditional revisioned
profile write. Concurrent settlement conflicts reread the winning revision;
old snapshots cannot overwrite the settled profile. History persists with all
later match receipts. No separate wallet transfer or claim that could pay twice.
Even unqualified seasons retain their actual record without a fabricated prize.

Hydration avoids altering an active match's season/profile; before any rollover
it drains pending result receipts so a still-journaled match's revision is not
consumed by settlement. Existing profile-unavailable guards remain. UI separates
projected/unawarded medal with UTC end date from permanently settled history.

Focused tier/year-boundary PASS0.004s, real isolatedMongo concurrent8readers/
singleaward/history/stalereplay/quietnextseason plus receipt replay PASS0.119s;
game eligible/restricted/forfeit selection PASS0.010s; mainPvP/duel0.241s;
UI9PASS0.777s; changedJS lint+build-trimpath-all PASS. DisposableMongo ran on
rediscoveredloopback32915 and is now STOPPED, retained. No real earned season
or full cross-feature matrix claimed. Remaining1.7: process-loss PvE resource
save projection, round status/cooldown cleanup, then version/notes/package.

1.6 originalCI34737205195 TERMINAL FAILURE, only old keyboard-test assertion.
Correction34c1c0d84a52e90144ca1bc34f1c549e7c3c1218 PUSHED from clean1.6WT.
ReplacementCI34738051311 confirmedIN_PROGRESS. Poll same run, then verify exact
client/server identity+DBready after deployment. No1.6live claim yet.

04:26 rated-results batch: replaced flat+25/-20 with team-mean K32 Elo (equal
teams ±16, lower gains for beating weaker opponents, rating floor0). Eligible
normal wins award50 Honor+3 season points. Losses and forfeits award no Honor or
season points to either losing players or forfeiture winners; forfeits still
affect rating. No hidden equipment/level normalization added.

Only the first3 meetings with each opposing player per UTC day change rating or
award rewards. If any participant hits the limit, that match records W/L but
neither team gains/loses rating or receives rewards. Team swaps do not reset it.
Bounded256-opponent history fails closed until midnight rather than evicting old
opponents and reopening farming. Counts and the actual leaver's5-minute penalty
are in the same immutable, revisioned result receipt; hydration restores them,
without treating the innocent teammate as a deserter. Daily rollover preserves
any unexpired penalty. Counter snapshots are detached; leaderboards omit them.

Durable last ranked result shows victory/defeat, team scores, exact rating delta,
Honor/season awards and the reason for withheld rewards. Chat uses those exact
values instead of the old unconditional+50/+15 text. Queue UI explains policies.
These safeguards do not claim perfect protection against multiple-account abuse
or earned season completion. Seasonal rewards/history are still required.

Focused reward/Elo/repeat/hydration/bounds/frozen-retry PASS0.010s; existing
arena/duel/maintenance/relationship selection PASS13.345s; actual disposableMongo
replay/counter/penalty/result persistence PASS0.172s; UI8PASS0.759s; changedJS lint
and go build-trimpath-all PASS. Main PvP/scene tests initially rejected their old
zero-HP social fixtures; explicitly living100HP fixtures PASS0.206s. The restored
Mongo container received loopback32914 (not32913); it is now STOPPED, retained.

1.6CI34737205195 remains active with one completed browser failure: old keyboard
test skipped the newly focusable preparation disclosure. Correction34c1c0d8 in
the1.6WT explicitly exercises summary focus/Enter/open then raid buttons; exact
SystemChrome case PASS8.3s. Await originalrun terminal before pushing correction.
No1.6live claim, no1.7publication. Remaining1.7: seasons/rewards/history, process-
loss PvE save projection, round status/cooldown cleanup, then package/deploy.

04:16 admission/resources batch: duels revalidate online/living/nearby overworld
actors at acceptance, reject shared-party allies and either player's queued arena
entry, and observe actor-before-PvP locking. Clean win, forfeit, maintenance and
timeout return the actual entry HP/MP (clamped to current maxima), not a free refill.
Round refills remain; UI explains this recovery policy. Abnormal process-loss
save projection and round status/cooldown cleanup still need review.

Focused admission/entry-resource/frozen-result cases PASS0.011s; arena/duel/
maintenance/relationship regression selection PASS13.349s; UI7PASS0.877s.

Publishing update:1.5 CI34735541628 is terminal green. Frozen1.6 commit564487ae
has been pushed; CI34737205195 is in progress. Await that run and exact live
identity/readiness checks before1.7 publication. The separately scheduled nightly
soak34735602173 was not started or cancelled by this batch.

04:08 durable-results batch: ranked profiles carry monotonic revisions and stable
match IDs. Mongo conditional upserts reject conflicting same-revision writes and
ignore old/replayed snapshots without overwriting newer outcomes. Hydration cannot
replace newer local revisions; ranked entry is refused if DB profiles are missing
or still behind a recorded result. Quarter reset retains revision and earned Honor.

Before applying ranked profiles or returning participants, the game synchronously
records a frozen, checksummed receipt in `<character-journal-dir>/arena-results`.
Atomic temporary write/fsync/rename/directory-sync,0600 files and hashed filenames
protect immutable receipts. This hook performs only filesystem IO, never Mongo
under gameplay locks. Record failure keeps the completed match reserved with a
visible Saving state; a five-second retry uses the identical decided outcome.
Practice/ties with no ranked rewards do not create receipts.

Normal persistence applies every receipt profile via revision checks, then removes
only that receipt. Mongo failure retains the journal and reports syncing instead
of an unverified reward. A five-second retry and pre-login startup replay recover
partial team writes; corruption or unrecoverable receipts block stale logins.
Schema10 marker blocks old schema9 unconditional PvP writers from destroying those
revisions. No backfill is needed. Once1.7 migrates production, rollback requires a
schema10-compatible server; NEVER delete the marker or pending receipts to force
an older binary to start. No production schema change has been made yet.

Focused actual Mongo tests PASS1.086s: reverse/concurrent revisions, duplicate
replay, conflicting same-revision rejection, partial two-player commit replay.
Journal reopen/detachment,0600/path/checksum/conflict/ack checks PASS. Frozen disk-
failure retry and stale hydration checks PASS0.070s. MainPvP/scene/lifecycle
PASS0.211s; focused gamearena/duel/zero-rating PASS13.473s; UI7PASS3.445s including
save-pending feedback; build-trimpath-all and diff checks PASS. Dedicated Mongo
`eidolon-isolated-qa-mongo-arena171309` (mongo7.0.14, loopback32913) is now STOPPED,
data retained for later focused tests. Explicit test URI env is
EIDOLON_ARENA_TEST_MONGO_URI; do not point those tests at production.

Still required: replace flat+25/-20 with rated-result calculations; anti-farming,
intentional-loss/disconnect safeguards; explicit personal/team result presentation;
earned seasonal rewards/history. Review direct-duel queued/shared-party admission,
entry HP/MP restoration (current PvP return still fills both), and round-status
cleanup. Current persistence work does not close those requirements or prove a
full live season/restart matrix. Runtime remains1.6 until1.7 packaging.

Publishing:1.5d8323180 now verified at BOTH public endpoints,Alpha1.5.0 and exact
commit; backenddatabase ready. CI34735541628 has passed all build/browser/predeploy
and deploy jobs, with finalLiveRelease/CharacterQA stillrunning04:05. Await its
terminal result before pushing frozen1.6; no1.6production claim yet.

First arena batch implemented locally. Existing1v1/2v2 modes now carry an explicit
practice flag through protocol, queue, match, result and UI. Practice2v2 retains
actual two-player teams and first-to-two elimination, without ranked profile
changes or a deserter penalty for leaving practice. Ranked defaults preserve old
client requests. Separate practice buttons do not mix into rated queues.

Rated matching prefers the oldest eligible team and its nearest compatible
average team rating: initial±100, +50 per30s, cap±500, BOTH teams must allow the gap.
Incompatible queue heads no longer block other teams. A once-per-second queue tick
can start a match without another join and sends the explicit arena scene via
OnPvPMatchStart. Actor availability is observed before taking PvP.mu; dead/offline/
instanced/changed-party entries are pruned. Same-party1v1 entries cannot match
allies who cannot damage each other. Match IDs include a sequence for same-tick
admission. Cancelling either party member removes the whole queued team.

UI shows practice/ranked, elapsed wait, team rating and actual search window,
polling only an open queued window every5s. It explicitly describes the existing
gear/level/build-sensitive policy,65% damage scalar and35% maximum-health hit cap;
no new hidden stat normalization. A tied timeout now cancels without rating or
rewards instead of arbitrarily awarding teamA. Existing decisive timeout wins stay.

Focused existing gamePvP/duel/arena checks PASS13.356s; new deterministic queue/
practice/revalidation/tie cases PASS0.045s; mainPvP/scene/lifecycle checks PASS0.102s;
sixUI cases inclpractice and polling cancellation PASS0.746s; changed JS lint PASS.
No broad matrix, live matches, season completion or earned PvP rewards claimed.

The original persistence risks found here are addressed by the later04:08 batch
above. Rated calculations, anti-farming, seasonal rewards and admission review
remain open; practice/queue implementation alone is not release completion.

## Initial inspection guidance

Inspect existing server PvP queue/match/rating/reward authority and its current UI,
protocol, persistence and focused tests before extending them. Existing behavior,
not older planning claims, determines missing functionality. Reuse present systems;
do not create a parallel arena framework or speculative abstractions.

Use focused changed-path checks, essential currency/save/progression safeguards,
relevant builds and release smoke. Full real-player season/integration/endurance
matrices remain consolidated final stabilization after all features, not repeated
at every patch. Keep reports short and feature-focused.

## Publishing dependency at creation

1.5 correctiond83231809994317aac31dcf1c901ae5e22791e2d is pushed;
CI34735541628 currently running. Verify1.5 exact client/server live identities,
then push prepared1.6 HEAD564487ae from its worktree and verify that deployment.
Do not push this branch while those milestones remain unpublished/unverified.
