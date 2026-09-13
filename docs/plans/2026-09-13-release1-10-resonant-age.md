# 1.10 — The Resonant Age

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
2. Finish working VIP games/higher stakes/premium variations on the actual upper
   floor, using the separate currency once the user supplies its name/acquisition
   policy. This question is already open. Do NOT invent currency, grants, purchase
   rules, exchange rates or Gold/Resonance fallback. A lounge facade is not done.
   Continue independent content work while awaiting the answer.
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

## Reusable 1.9 evidence and remaining integration

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

Next feature dependency is the previously requested VIP currency name and
acquisition policy. It remains unresolved; do not invent or omit this scope.

## 1.9 release evidence

1.9 release/worktree is frozen at e86e29a0f808e7547678c77485b8441c06ee067c in
/tmp/eidolon-1-9-world-20260913, pushed master. ExactCI34749377284 currently has
server/client and browser shard3 passed; shards1/2 still running. Monitor the
SAME run.1.8 remains last verified live until1.9 confirms.
Release corrections belong in the frozen release WT, then merge forward here.

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
