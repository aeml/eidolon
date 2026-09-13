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

## First work

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
