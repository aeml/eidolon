# Executioner Spin — reproduced area-consumer defect

Status: diagnostic only, not repaired, integrated or deployed. This is part of
the existing full talent-consumer gate, not a replacement for that gate.

## Reproduction

Worktree `/tmp/eidolon-executioner-area-dfzcT7` branches from candidate a378ac3d.
The ordinary paid-cast overlay now pairs rank-zero/rank-five Executioner Spin
casts for its Technique (`FTR_24`), Lineholder Instinct (`FTR_33`) and Enduring
Rhythm (`FTR_38`). The same enemy is positioned at6.3 units plus its body radius
in both casts. Baseline radius6 excludes it; five Technique/Rhythm ranks should
reach6.6, while five Lineholder ranks should reach6.9. Both ordinary and scale4
body sizes are checked. Level100, unlocked skill, initial mana and isolated
instance are explicit prepared fixtures; no production account is changed.

Diagnostic90581 exited1, game3.686s, log
`/tmp/eidolon-executioner-area-consumer-red.log`. All six baseline controls pass;
all six rank-five casts are accepted and spend40 mana but fail to damage the
enemy in the trained annulus. The other existing probes pass. This establishes
a real consumer defect, not merely missing metadata or a rejected-cast fixture.

## Source findings and required repair

- `ability_fighter.go` uses a fixed6-unit query/final hit radius despite the
  applicable talent definitions. Use one effective radius for both, preserving
  dungeon wall checks, body padding, hostility, damage formula, the marked/threat
  bonus, costs, cooldowns and kill-credit delivery. Publish the accepted cast's
  actual self-centered radius/arc so observers need not know private ranks.
- `abilityRadii.js` currently applies Fighter area talents only to Guardian
  Roar. Enroll Executioner Spin and add its scoped Technique metadata without
  applying that Technique to another skill. Keep generic bonuses additive and
  rank normalization/clamping consistent with the server.
- Offline `Fighter.js` currently substitutes a1.5-second legacy Whirlwind-like
  tick sequence with radius3 for the server's single radius6 strike. This is a
  source-level parity finding, not yet an actual offline-cast reproduction.
  Reproduce it before repairing the offline consumer; preserve the spin's visual
  animation but do not retain divergent repeated damage as an area-only fix.
  Ensure actual damage, friendly exclusions and dungeon geometry agree with the
  authoritative strike, and that moving during the animation cannot hit a new
  target through a later legacy tick.

Required acceptance: ordinary casts at ranks0–5, composed/unrelated ranks,
inside/outside body boundaries, walls, hostile/friendly/dead/other-instance
actors, normal damage and marked/threat bonus, mana/cooldown invariants and
kill credit. Client coverage must exercise actual offline effects, local/remote
high/low rings and correction of a stale prediction without replaying damage
or animation. Add ordinary UI purchase/save/native rendered proof, then full
regression and normal versioned release gates. Existing saved IDs and ranks must
remain intact. Do not mutate the frozen four-player dungeon source or silently
fold this incomplete work into the accepted utility candidate.
