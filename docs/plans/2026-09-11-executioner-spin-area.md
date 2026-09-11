# Executioner Spin — reproduced area-consumer defect

Status: local repair with focused checks; native/full regression/integration and
deployment remain pending. This is part of the existing full talent-consumer
gate, not a replacement for that gate.

## Reproduction

Worktree `/tmp/eidolon-executioner-area-dfzcT7` branches from candidate a378ac3d.
The ordinary paid-cast overlay now pairs rank-zero/rank-five Executioner Spin
casts for its Technique (`FTR_24`), Lineholder Instinct (`FTR_33`) and Enduring
Rhythm (`FTR_38`). The same enemy is positioned at6.3 units plus its body radius
in both casts. Baseline radius6 excludes it; five Technique/Rhythm ranks should
reach6.6, while five Lineholder ranks should reach6.9. Both ordinary and scale4
body sizes are checked. Level100, unlocked skill, initial mana and isolated
instance are explicit prepared fixtures; no production account is changed.

Initial diagnostic90581 exited1, game3.686s, log
`/tmp/eidolon-executioner-area-consumer-red.log`. That first fixture was insufficient:
RecalculateStats reset an empty BaseStats character to zero attack stats, making
the absence of damage ambiguous. The first standard-server red91703/7.124s and
first repaired attempt95126/7.722s retained that fixture mistake. Do not cite
these initial misses as proof of the runtime defect.

Corrected fixture supplies InitialPlayerStats and adds a nearby positive damage
control to every paired cast. Against unchanged candidate a378ac3d via Go overlay,
37747 still fails exactly six trained annulus cases in1.007s, with all untrained
and nearby positive controls passing. Log
`/tmp/eidolon-executioner-corrected-parent-red.log`. This establishes the actual
fixed-radius consumer defect. The corrected diagnostic on the repaired source
71674 passes3.321s, including the other probes. Three server-defined area
bonuses are covered; Enduring Rhythm's older UI description omits its area effect,
so this is not a claim that all generic Fighter copy is now accurate.

## Original findings and repair boundaries

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

## Local repair and focused acceptance

The handler now resolves one trained radius for its broadphase, final geometry
and self-centered radius/arc event. No server damage/cost/cooldown/taunt eligibility
formula changes. Client area metadata is skill-scoped; predicted and remote
authoritative rings use the same radius. Offline spin now pays through the normal
base Actor path and strikes once with the server's base/mastery/Rhythm and marked/
threat-bonus ordering, ordinary critical handling and receiving damage handler.
The normal spin animation remains; legacy Executioner Whirlwind tick flags and
duplicate cooldown/presentation are removed. Whirlwind behavior is not retuned.

Actual client red61993 failed33/34 in1.736s: no immediate offline hit, legacy
channel enabled and no authoritative boundary. The first implementation69490
left14 cooldown expectations failing because the fixture already has2% global
CDR. Expected cooldowns now include that existing global stat, not a runtime
change. Final43429 passed103 tests/4suites3.460s, full lint and discovery of the
new isolated phone route. Logs `/tmp/eidolon-executioner-{client-red,client-first,
final-client,final-lint,discovery}.log`. Earlier16004 passed84/3/2.911s.

Server83603 passed current area/wall coverage14.556s; expanded2867 passed17.826s
under race detection, including ordinary Technique purchases0–5, unchanged mana/
trained cooldown and all-party kill credit. The JSON cases cover baseline,
Technique one/five, Lineholder, Rhythm, combined8.1 and unrelated Roar Technique;
both sides of normal/large target boundaries are checked. Logs
`/tmp/eidolon-executioner-server-{second,final-focused}.log`.

Additional exact actual-server damage24141 passes under race2.418s, preserving
base/mastery/Rhythm, weak-point, existing receiving weakness and threat-bonus
ordering. Log `/tmp/eidolon-executioner-damage-contract.log`.

Client checks also cover friendly/dead/inactive exclusions, walls, duplicate
broadphase entries, a new target reached only after the cast, insufficient mana/
cooldown and multiplayer guards, mastery/mark/threat damage, both graphics
qualities and stale accepted-shape correction without animation replay.
Prepared unit fixtures are not an earned build or native dungeon proof.

Added `executioner-spin-area` ordinary phone purchase/save route and explicitly
allowlisted its disposable account. It is included after Guardian Roar in the
full required-all chain; no existing route is removed. It expects baseline6,
Technique6.6, Technique+Lineholder7.5 and all-three8.1 rings, low/high quality and
fresh-login landscape saved ranks. This route has only been discovered, NOT run.
Run it after the sole current four-player gate ends; prepare generated vendor in
this new worktree first. Full client/server/browser and versioned release checks
remain due; do not claim native acceptance from route source or discovery.

Proposed patch note: Executioner Spin now honors its area talents, with a visible
ring that matches the strike. Offline play resolves the same single strike rather
than repeated short-range ticks. Existing talent ranks and ordinary costs remain.
