# 1.10 — The Resonant Age

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
The guarded VIP floor is intentional for now; EP exchange/allowance quantities
were requested asynchronously and remain undecided, with payment integration
excluded. Continue remaining1.10 scope and consolidated integration without
repeating successful1.9.1 release checks or claiming the full roadmap complete.

User requested publishing the completed shared casino/quick-play changes now.
Package these plus the already completed aftermath/Help content as **1.9.1**, with
matching login/runtime identities and cumulative patch notes. This is not final
1.10 acceptance. Earlier local-only checkpoints below describe implementation
history; deployment success must be verified against this release's exact commit.

## Latest user direction — September 13

VIP currency is **EP (Eidolon Points)**, planned from a monthly VIP allowance
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
2. Follow the approved EP economy policy for future VIP games/higher stakes/
   premium variations and the cosmetic VIP Vendor. Resolve the remaining monthly
   allowance, exchange rate and access details before enabling them; do not add
   payment integration, invent quantities or use Gold/Resonance fallback. The
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
