# Alpha 1.7.0 — a competitive arena

Separate worktree based on prepared1.6 commit564487ae. Runtime stays1.6 until
1.7 packaging. This stage does not authorize skipping1.5 or1.6 live delivery.

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

Next required work: rating-aware result deltas, anti-farming/intentional-loss and
disconnect safeguards, explicit team results, seasonal rewards and durable replay-
safe settlement. Inspect existing main `persistPvPMatchResult`/`hydratePvPProfile`
and database/pvp.go: current results still use flat+25/-20 and blindly replace
profiles asynchronously; hydration can overwrite newer in-memory state while a
save is pending. Resolve that, quarter rollover and unavailable-storage behavior
before shipping1.7. Practice/queue implementation does not prove reward safety.
Also review direct-duel admission versus queued/shared-party state before release.

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
