# Fighter duration consumers — ordinary-cast reproduction

Status: confirmed local defect; not repaired or deployed. Part of the existing
full talent-consumer gate, not a new substitute milestone.

The diagnostic branch `work/fighter-duration-audit-20260911` in
`/tmp/eidolon-fighter-duration-fSuAnl` starts from integrated primary ee1da4b4.
Only the diagnostic overlay and this record change. The primary regression source
and successor689b0142 remain untouched. No production character or service changes.

## Evidence

`TestPendingTalentFighterShieldSlamDuration` performs real accepted, paid Shield
Slam casts with rank0/rank5 in FTR_30 or FTR_37, both without a rune and with
Concussion. Fixtures explicitly prepare level100, initial base stats, one unlocked
skill, ranks/rune, mana and a nearby living nonimmune enemy. Every case requires
damage, stun,25mana paid and a normal cooldown before inspecting duration.
Deadlines are bracketed by actual cast start/finish rather than sleeping or
assigning status timers. These are prepared casts, not earned builds.

78560 exited1, game2.092s: exactly four trained duration cases fail. Rank-zero
controls and all previous area/critical diagnostic probes pass. Ordinary stun is
still1.5s at rank5; Concussion is still2.5s. Definitions require:

| Talent | Per-rank definition | Rank5 ordinary | Rank5 Concussion |
|---|---|---|---|
| FTR_30 Crowd Control Drills | +4% duration | 1.8s | 3.0s |
| FTR_37 Breakthrough | +3% duration | 1.725s | 2.875s |

Log `/tmp/eidolon-fighter-duration-consumer-red.log`. The first preparation had a
missing closing brace caught by gofmt; no test ran then. It was corrected before
78560. Syntax errors are not runtime-defect evidence.

## Implementation boundaries and next proof

The server cone helper writes the authored stun directly without applying
`resolveAbilityEffectDuration`; the offline Shield Slam path likewise writes1.5.
Other Fighter buff/root/slow deadlines also use authored constants on source
inspection. Those other consumers still need actual paired-cast/expiry proof.

The old UI copy is independently inconsistent: FTR_30 describes flat stun/slow
seconds and FTR_37 armor penetration, while the server definitions assign generic
percentage duration. This reproduction proves the missing **server-defined**
benefit; it does not establish the old descriptions as correct or authorize
silently discarding them without an explicit design explanation.

Repair must reconcile intended benefit, descriptions, saved ranks and actual
consumers. Test rune-before-talent composition, unrelated/mastery controls,
rank0–5/composed ranks, immunity/death/instance/wall exclusions and actual expiry.
Keep cooldowns, cast/charge travel windows and movement locks separate from
effect durations; do not accidentally extend those via a blanket time multiplier.
Check reflected/secondary effects and observer timer replication. Preserve
ordinary cost and kill credit. Offline/server parity and visible saved-training
proof are required before release; no global talent-tree sign-off from one probe.

This branch is diagnostic only. Do not delay or relabel the frozen primary's
full server run, merge this red probe into its standard suite, or claim the
accepted hotfix candidate already repairs these duration consumers.
