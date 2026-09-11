# Executioner Spin — reproduced area-consumer defect

Status: local repair accepted by native and full regression checks; versioned
release and deployment remain pending. This is part of the existing full talent-consumer
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

## Self-centered input follow-up — September11 01:51

The paid strike was fixed but its client controller still treated Spin as a
targeted ability. Added actual controller tests for distant desktop hover and
phone selection, a missing ground intersection and buffered movement. Added an
actual Fighter cast check that all predicted cosmetics remain at the owner even
when the caller supplies a distant cursor.98828 RED4/52 in2.301s reproduces these
input/presentation defects on c4e7c743; no native failure is implied.

Spin is now enrolled in the existing self-cast controller path, retaining normal
resource/cooldown checks and buffered input. Its class cast normalizes the visual
target to its owner too. No other ability's targeting policy changes.66256 PASS
138tests/7suites3.947s plus full lint. Logs
`/tmp/eidolon-executioner-self-cast-{red,final,lint}.log`.
Generated browser vendor preparation93129 also exited0. The native route is now
ready to execute when the unchanged four-player gate53491 becomes terminal;
it has not run yet. Full regression/required-all/integration/release gates remain
open on this changed source. Add to the eventual patch note: Spin no longer
chases or refuses to cast because of a distant selected/hovered enemy.

## Native and full regression acceptance — September11 02:43

The preceding pending-native labels are historical. Clean a0cda0ff passed native
85991 in24.5s: ordinary phone branch-C selection, five paid ranks each in
FTR_24/FTR_33/FTR_38, accepted radii6→6.6→7.5→8.1, attached authoritative rings
in low/high quality, and fresh-login landscape saved ranks. Explicit prepared
level100/resources remain fixtures; this does not prove earned progression,
physical-phone ergonomics or a native hostile hit. Archive
`/tmp/eidolon-executioner-native-proof-lR6UEF`, log
`/tmp/eidolon-executioner-native.log`; disposable services/ports were removed.

Full Go race75374 exited0: root21.131s/game384.704s, all packages passed with
no race warning. Full client14482 exited0:279suites/3952tests142.091s and full
lint. Logs `/tmp/eidolon-executioner-full-{server,client,lint}.log`.

Current104-case browser acceptance is complete on the same unchanged source.
Initial24016 terminated143 after group1's39 cases passed, during group2 layout;
the signal's cause is unconfirmed, not a test pass. Preserved interrupted proof
`/tmp/eidolon-executioner-current104-interrupted-wICB21`; only its verified orphan
web server and exact shell/npm ancestry were stopped, then port41981 was clear.
Complete group2 retry60386 exited0 with40 cases; group3 session45200 exited0
with25. All12 embedded reports were inspected:104 expected, zero unexpected,
flaky or skipped. Exact partition discovery had verified no omissions/duplicates.

Stage wall times including invocation: group1 layout131.0s/entrances23.4s/
effects75.9s/nameplates20.8s/resource-HUD11.5s; group2 layout196.0s/
entrances18.7s/effects27.4s/interface49.4s; group3 layout113.1s/entrances19.2s/
effects19.4s. These are local regression durations, not a CI speedup benchmark.
Archive `/tmp/eidolon-executioner-current104-proof-zv6zgi` contains separate stage
reports/results and all three logs; supplied credential scanner changed0 files
for this anonymous run. Port41981 is clear. Inspected current screenshots cover
the four-target720p healing roster,390px expanded chat/Forge,360px stash detail
and portrait encounter framing. No new clipping observed; dense Forge copy and
physical-device play remain open. No pixel-redaction claim.

Integration review confirms this branch fast-forwards a378ac3d, preserving the
existing candidate changes. Spin joins required-all without removing any prior
route. No new version or deployment is implied by these local passes. The full
talent-tree, four-player dungeon/campaign and original roadmap remain open.
