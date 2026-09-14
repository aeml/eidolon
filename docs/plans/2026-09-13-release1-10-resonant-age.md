# 1.10 — The Resonant Age

## Alpha 1.9.6 — pushed, exact CI in progress

Pushed **f99bc61e4c78b844d6f4c673960df961021b4b14** to origin/master.
Exact CI **34797469252** authoritatively IN_PROGRESS:
https://github.com/aeml/eidolon/actions/runs/34797469252 . Continue this same run;
do not replace it or rerun passed local checks. Not yet verified live. Last
verified live release is1.9.5 below, whose CI is complete and must not be repolled.

Veyra's twelve cosmetic EP unlocks/preview/vendor and the trusted100EP membership
month allowance are implemented and focused-tested. No billing/real VIP grants.
See [membership policy, operator preview and evidence](2026-09-14-vip-membership.md)
and [vendor implementation](2026-09-14-vip-cosmetic-vendor.md). Matching1.9.6 version
defaults, login label and cumulative patch notes are prepared. EP-only games and
functioning upstairs VIP access remain next, not complete; full1.10 stays active.
Deliver those remaining VIP games/access together as a meaningful feature batch,
not a separate release for each small table or staircase edit.

## Alpha 1.9.5 — verified live, all CI jobs passed

September14: exact **5d024b3b987ce74917491cff5fcb93548fe4308a**, Alpha1.9.5 verified
on both public endpoints, backend database ready. CI **34795245270** is TERMINAL
SUCCESS across all ten jobs, including final live character QA. Do not poll or
restart this completed workflow. Earlier in-progress statements below are history.

## Next feature batch — cosmetic vendor implemented locally

September14: Veyra’s physical VIP Outfitter, twelve EP-only realm-themed cosmetics,
real character preview/compare, confirmed durable purchases and wardrobe apply are
implemented and focused-tested. Not yet deployed or version-packaged. See
[vendor scope, evidence and pending patch notes](2026-09-14-vip-cosmetic-vendor.md).
The existing1.9.5 CI34795245270 remains IN_PROGRESS (client/server and browser
shards2/3,3/3 passed; shard1/3 running at last observation). Do not supersede it.
Continue trusted VIP allowance/EP games while waiting; keep the full goal active.

## Alpha 1.9.5 — pushed, deployment in progress (September 14)

Pushed **5d024b3b987ce74917491cff5fcb93548fe4308a** to origin/master.
Exact workflow **34795245270** was authoritatively observed IN_PROGRESS:
https://github.com/aeml/eidolon/actions/runs/34795245270 . Continue watching this
same run; do not restart it or rerun passed local tests. Not yet verified live.
After success, check both public version/commit endpoints against this SHA.
Full1.10 goal remains active; EP follow-on features below are not implemented.

The named-resident regression below is now reproduced and fixed. Four real
procedural service models were pooled and rebound to witnesses; all four raycasts
selected their previous service owner before the correction. Entity.setMesh now
rebinds descendant click-target IDs too. Focused tests cover model reuse in both
directions, correct witness conversations, and original service targeting.

Implemented the first approved EP economy feature end to end: private wallet in
the character sheet, exact 1,000,000 Gold/EP one-way exchange, explicit cost review
and confirmation, server town/alive/out-of-combat checks, whole-number/overflow
validation, and one full durable character snapshot containing both balances and
idempotency receipt. The client preserves pending receipt IDs across tab reloads
and retries without creating new spending operations. Database failure/reopened
journal recovery is covered. EP is neither public replication nor a Gold item.

Next requirements remain: cosmetic VIP Vendor, trusted VIP entitlement and 100 EP
monthly allowance, separate EP-only games (up to 100 EP) and functioning VIP
floor. No payments or power rewards. Wallet UI and 1.9.5 patch notes explicitly
warn that spending is not yet available; this is not VIP/1.10 completion.

Evidence: 288 client tests across witness/raycast/wallet/version suites; EP
database arithmetic, world access/private snapshot and handler/save-recovery
checks; two desktop/phone browser confirmation fixtures (8s), reviewed screenshot
/tmp/eidolon-ep-confirmation-390.png. Focused lint/whitespace checks pass.
The browser fixture uses the actual character-sheet display mode and asserts a
readable panel width, not merely lack of overflow. No soak or broad local matrix.

Persistence/rollback: EP fields live in the existing single-character-per-account
snapshot, beside the Gold they spend. Any future multi-character feature must
migrate wallet/allowance ownership before enabling extra characters. Once EP is
issued, do not roll back to a server predating these fields; it could overwrite
them on a full save. Preserve the new fields/receipts in any compatibility build.

## Original report — named town residents (September 14)

User reports that clicking Mara Fen, Dain, Hessa, and Selen opens the Talent
Master, merchant, daily quest giver, or dungeon guide respectively. Resolve this
during the remaining 1.10 work. These are Chronicle witnesses with their own lore
conversations, not replacements for the existing service NPCs; preserve the real
services and make each resident's identity and interaction unambiguous.

Inspection: witness definitions deliberately reuse those four service models,
but have separate entity classes and conversation handlers. Check pooled meshes
and descendant hitbox ownership: Entity.setMesh changes only the root entityId,
Actor hitboxes carry their own entityId, and MeshFactory reuses meshes without
clearing those IDs. This was initially a suspected routing cause, subsequently
reproduced and fixed above. The focused regression reuses each service model for a witness,
clicks the actual geometry/hitbox, and checks the named conversation, including
after leaving/re-entering town. Confirm the original services still work and
remove any genuinely redundant spawns found, not the distinct story residents.

Production rechecked September 14: frontend release.json and backend healthz
both report Alpha 1.9.4 at 7b370f2576153d9beac37d3e65735c51d990ec7e;
backend database ready, origin/master matches. No redundant deployment launched.

## Latest interim release — Alpha 1.9.4 verified live

After1.9.3, user requested stable seated multiplayer card layouts and continuous
clocks, plus casino roof/door/stash fixes. Implemented with focused client/server,
disposable currency-persistence and desktop/phone visual checks. User now requested
push/deploy; **verified live September13 23:29UTC**, exact commit
**7b370f2576153d9beac37d3e65735c51d990ec7e** on both public domains with database
ready. CI34788160140 TERMINAL SUCCESS, no rerun: predeploy4PASS1.2m; live gameplay
8PASS5.9m; recovery2PASS1.2m; two-player aura1PASS35.3s. Do not repeat the completed
workflow. See
[release notes and evidence](2026-09-13-persistent-card-tables-and-town-entrance.md).
EP and full1.10 completion remain follow-on work. Earlier statuses are historical.

## Previous interim release — Alpha 1.9.3 verified live

User requested pushing the completed casino hand feedback, win/bonus celebrations
and 100,000 Gold limits live. Packaged with aligned version defaults and cumulative
patch notes. EP-only wagering policy is recorded, but its wallet and games remain
follow-on work. September13 21:18UTC: exact commit
**03373b0f3df9d03e0bca76d3f3b95b6b8d142423** verified on both domains,
database ready. CI34781528097 deployed successfully but remains FAILURE because
the final aura test recorded Chrome ERR_NETWORK_CHANGED during host Docker link
creation. Predeploy4PASS; live gameplay8PASS; recovery2PASS. One unchanged,
targeted live two-player recheck passed1test1.1m with zero retries. Do not rerun
the full pipeline or claim all-green CI; see
[release evidence and rollback compatibility](2026-09-13-casino-celebrations-and-stakes.md).

## Previous interim release — Alpha 1.9.2 verified live

September13 20:08UTC: **3651c4c9773ea75c449889192ad0cfd80e75ef45** live on both
public domains, database ready; exact CI34778003801 SUCCESS all ten jobs. Roomy
seated casino controls, between-round 20–500 Gold slot bets, half/double shortcuts
and a stale-scene Recall correction are deployed, with cumulative patch notes and
aligned version defaults. Predeploy4PASS; live gameplay8PASS; recovery2+1PASS.
See [release evidence and rollback caveat](2026-09-13-casino-roomy-controls.md).
EP quantities/policy are recorded below, but wallet/exchange/allowance/vendor
remain unimplemented. Full1.10 is not complete. Do not repeat the completed CI
or start a documentation-only release. Older live/local statuses are historical.

## Interim release — Alpha 1.9.1

**Verified live September13 18:00UTC:** c87412881f689684be94248e951d632994eef68e,
Alpha1.9.1 on public client/runtime and backend, database ready. Exact workflow
34771598671 completed SUCCESS across all ten jobs. Live gameplay8passed(6.9m),
town recovery/Well Rested2passed(1.4m)+1passed(50.8s), no reported flaky result.
This run is terminal; do not poll/restart it. The earlier aa940fcb run failed one
obsolete22-collider assertion; the correction checks23 plus the physical door's
exact bounds. No runtime behavior was changed to satisfy that test.

The shared casino, direct wagers/animated auto-spin and aftermath/Help content
below are now shipped. Their earlier local-only checkpoints are historical.
The guarded VIP floor is intentional for now; the user has since specified EP
exchange/allowance quantities and cosmetic-only spending below. Payment
integration remains excluded. Continue remaining1.10 scope and integration without
repeating successful1.9.1 release checks or claiming the full roadmap complete.

User requested publishing the completed shared casino/quick-play changes now.
Package these plus the already completed aftermath/Help content as **1.9.1**, with
matching login/runtime identities and cumulative patch notes. This is not final
1.10 acceptance. Earlier local-only checkpoints below describe implementation
history; deployment success must be verified against this release's exact commit.

## Latest user direction — September 13

**Latest answer supersedes the older policy below:** exchange exactly
**1,000,000 Gold for 1 EP**; VIP allowance **100 EP monthly**. EP spending is
**cosmetics only, never pay-to-win**. No reverse exchange or indirect Gold/
resource payouts, power boosts or progression advantages. Cosmetic purchases
are appearance unlocks, not stat gear. **Follow-up clarification:** EP wagers up
to100EP ARE authorized and pay ONLY EP, whose reward utility stays cosmetic-only.
This replaces the earlier interpretation that prohibited EP wagers. Public Gold
stakes may reach100,000Gold. EP wallet/games remain follow-on VIP work; preserve
the current guard and Gold games until that currency system is implemented.
Payment integration stays excluded. The quantity blocker is resolved; proceed
with the one-way exchange/cosmetic economy, retaining durable receipts and saves.
See the authoritative [EP policy](2026-09-09-town-casino-roadmap.md#ep-economy--approved-direction-not-implemented).

**Historical direction, superseded above where conflicting:** VIP currency is
**EP (Eidolon Points)**, planned from a monthly VIP allowance
and fixed-rate Gold → EP exchange. Uses are limited to casino content and a
future cosmetic VIP Vendor (armor/weapon/shield skins). Approximately $5/month
is a suggested subscription price, not final; allowance, exchange rate and other
VIP bonuses remain undecided. Payment/purchase integration is explicitly excluded.
See [approved EP policy](2026-09-09-town-casino-roadmap.md#ep-economy--approved-direction-not-implemented).
The current request still gates upstairs with a guard saying **“You must be a
VIP to enter”**. Do not invent wallet amounts or purchases. The town casino door should open a dialogue with
**Enter Casino**, transporting all players to the SAME large two-storey social
zone with multiple public Gold tables/machines. See the updated casino roadmap.
Earlier blocked-currency checkpoints below are historical, not a reason to stop
this revised implementation. Full1.10 acceptance still requires its remaining
integration work; a guarded lounge is not a claim of functioning EP games.

Active development branched from packaged1.9 e86e29a0. Runtime stays1.9 until
the complete1.10 milestone is ready. Full scope remains the September5 roadmap,
its completion criteria and the September9 two-floor casino checklist. A version
bump alone does not complete the goal; every earlier promised feature remains.

## Delivery order

1. Finish remaining content: small post-Malachar story hook and a sustainable,
   understandable content cadence using existing campaign/weekly/PvP/world-event
   systems. Inspect existing implementations before adding anything; preserve
   Ilyra's story, earned progress and optional-daily philosophy. No fifth class,
   large continent, additional reward framework or speculative architecture.
2. Implement the approved one-way Gold → EP exchange and cosmetic VIP Vendor,
   with 1,000,000 Gold per EP and 100 EP per VIP month. Cosmetic prices/content
   must obey the no-power/no-indirect-Gold policy; do not add payment integration
   or invent new VIP entitlement benefits. Implement separate EP casino wagers
   capped at100EP with EP-only winnings and no indirect Gold/power conversion. The
   current guarded-floor delivery remains authorized and is not functioning EP
   wagering. Continue independent content/integration work without reopening the
   now-resolved currency name/source question.
3. After features, perform ONE consolidated acceptance pass using retained valid
   evidence and filling actual gaps. Cover fresh campaign and real group raid,
   saved progress/reward economy, full public/VIP casino loops and multiplayer,
   desktop and phone touch flows, inspected High/Low visuals, documented baseline-
   based performance/concurrency targets, recovery and backup/rollback. Prepared
   fixtures do not establish earned clears. Respect existing physical-phone
   feedback; collect only missing/relevant device evidence. No repeated broad
   matrices or new long soak merely for reassurance; fix and rerun affected paths.
4. Update cumulative patch notes and ALL version defaults, deploy1.10 only when
   the full milestone is actually ready, verify both exact live identities and
   release behavior. Audit requirements against concrete evidence before marking
   the overall goal complete. Missing VIP authority is not permission to omit it.

## September 13 — story and content cadence implemented locally

`src/data/chronicleAftermath.js` adds **A Letter Without a Throne**: an optional
Ilyra conversation after the saved, manually completed Dark King quest, plus
linked Mara/Selen topics. Malachar remains dead; all four crystals and the
existing finale remain intact. No new quest, reward, save schema or reset.
The existing completion speech appears first, and old completed characters can
read the hook without replaying the campaign. Open topics/focus survive unrelated
quest updates. This is a small mystery hook, not an additional campaign chapter.

Help now contains **Your Next Adventure** in place of the outdated daily-reward
optimization loop. It explains optional permanent story, the ten-minute event
rotation, midnight Eastern daily contracts, Monday 00:00 UTC personal raid cache,
quarterly UTC seasons and player-organized activities. Corrected the obsolete
blanket party-bonus claim. `docs/CONTENT_CADENCE.md` grounds the operating/release
rhythm in existing authoritative systems without adding scheduler/reward code.

Focused verification: aftermath + existing manual conversations/witnesses,
43 tests PASS in 3.623s; changed JavaScript ESLint PASS; changed Help cadence
assertion PASS in 1.164s (247 unrelated presentation checks intentionally skipped);
`git diff --check` PASS. Broad browser/device/integration remains consolidated
after all features. Neither local story nor Help content is deployed yet.

At this historical checkpoint, currency name/acquisition were unresolved. The
latest user direction above now resolves those; quantities remain undecided.

## 1.9 release evidence

1.9 is deployed at e86e29a0f808e7547678c77485b8441c06ee067c. ExactCI34749377284
is TERMINAL SUCCESS, including both deployments and live town/Well Rested checks.
Public release.json and healthz independently returned this exact Alpha1.9.0
commit with database ready. Do not poll/restart the completed run.

Live caveat: Water's final recall after re-entry (`regional-dungeon-gameplay`,
line61) failed its 30s town-recovery predicate once, then passed CI's configured
retry. Seven other live tests passed; full workflow success does not diagnose
that intermittent failure. Its original Boolean assertion concealed whether
position, layout, collision or scenery failed. Local diagnostic-only152026d8
in `/tmp/eidolon-1-9-world-20260913` now reports the same required conditions
separately, with unchanged timeout/acceptance. Syntax/diff checks pass. Merged
forward here; no new deployment or duplicate suite launched for a test-only edit.

Focused follow-up completed: `EIDOLON_ISOLATED_QA_ROUTE=water-recall` now runs ONLY
the existing Water route, with retries disabled, on the standard disposable
server/database. Run waterrecall0913a PASS (33.6s test,38.4s Playwright total),
including entry/eastward movement/reconnect/recall/re-entry/final recall and all
diagnostic predicates. Production gameplay unchanged. This does not diagnose or
erase the earlier intermittent live failure; retain it for final integration,
and do not repeat unchanged routes hoping to manufacture a diagnosis. The route
is local f14507b0, merged here. Syntax/diff checks PASS; credential artifact scan
PASS. Its temporary containers/database/image were removed by the existing trap;
post-run container inspection confirmed no waterrecall0913a containers remain.

Implementation is now awaiting the user's separate VIP currency name/acquisition
policy. This same unresolved authority has persisted across more than three goal
turns; 1.9 deployment and the independent targeted follow-up are finished. No
currency fallback or invented monetization. Resume VIP work when supplied, then
the ONE consolidated final acceptance pass and full1.10 release. Goal blocked
on that choice, NOT complete. No further unchanged test polling/restarts needed.

See 1.9 release, elemental-slot and Fourfold-poker handoffs. Implemented: rotating
four-realm defended events and hazard calming; repositioned stash/full walkable
two-floor venue; four differentiated durable Gold slots; real-player Hold'em;
existing solo/multiplayer-house blackjack retained. Public slots' initial payout
tuning is recorded; no exact RTP promise. Actual spatial release check sampled
323 points against542 scenery colliders with no blocked approaches/spawns/runes.
Actual two-player poker continued unchanged across a mid-hand server restart,
finished a full showdown and conserved saved Gold. Actual Air event broadcast
showed two nearby players the same active wave without a joining Gold reward.

Still unproven by those checks: fully connected world walk→stairs→seat→camera→
game→leave flow as one scene, earned complete public-event combat, populated-floor
performance, VIP currency/content and cross-feature/device interactions. Carry
these into final integration; do not label them passed from component fixtures.
No QA server/browser/disposable Mongo was left running at1.9 handoff.

User priority is feature-first/token-efficient work. No subagents authorized.
Keep the root checkout ledger-only and NEVER PUSH ROOT.
