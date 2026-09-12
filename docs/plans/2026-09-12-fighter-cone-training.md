# Fighter cone training — 1.1.0 candidate, native acceptance pending

Parent `11d6920d` (accepted Whirlwind runtime plus release movement-QA
forward-port). This is a foundation talent/dungeon consumer correction, not
another ordinary 1.0.x release or closure of the full talent/dungeon checklist.

## Reproduced gaps

Shield Slam and Sweeping Strike use fixed4/5-unit server radii despite their
Technique2%-area-per-rank and generic area training. Their accepted events omit
radius/arc. Sweeping Strike also ignores its named4%-damage Mastery and generic
damage training. The offline Sweeping implementation uses Strength-only damage,
full3D distance, mesh-facing instead of the aim, no body padding and no wall or
friendly-target filter, unlike its authoritative counterpart.

Actual paid-cast tests first exposed an invalid zero-base-stat area fixture;
initialize real base stats, retain the mana/central-hit controls, and rerun.
Corrected RED1.395s: all twelve area cases lack accepted shape, ten trained
edge cases miss, and five trained Sweeping damage cases retain base62 instead
of the expected64..80. Untrained damage remains62. Client RED15fail/1pass2.034s.
No game costs or damage are changed to accommodate the initial fixture failure.

## Implementation

- Shield Slam snapshots trained radius4..5.4; Sweeping Strike5..6.75. Preserve
  90/180-degree total angles, target-body padding, walls, mana25/30, cooldowns,
  normal criticals and doubled threat. Read normalized server training without
  mutating saved ranks. Sweeping applies named/generic damage exactly once.
- Accepted events carry their radius/arc through the existing public payload.
  Local prediction and rank-private remote visuals agree. A stale predicted
  cone is replaced once at the accepted radius without replaying animation.
- A shared paid-offline cone consumer matches planar aim/radius/angles, body
  padding, dungeon walls, scene/hostile/dead/remote exclusions and unique hits.
  Sweeping now uses Damage + floor(1.2*Strength), named/generic training and the
  ordinary critical pipeline. Remove its redundant legacy unscaled cone; retain
  the canonical trained presentation. Shield Slam keeps its existing damage,
  stun/runes and Fortify behavior, delegating only common geometry/hits.

## Verification and limits

Final focused client: seven suites/161 tests PASS5.496s, full lint/whitespace
pass. Coverage includes paid rank0/1/5 and generic0/5, body-padded edges,
out-of-angle/behind/friendly/dead/remote/other-scene/duplicate exclusions,
wall/doorway pairs, resource/cooldown rejection, no online predicted damage,
single critical scaling, High/Low attached cone boundaries, accepted correction,
and the full existing Shield Slam rune/duration/absorption regressions.

Expanded server race: PASS23.984s, including actual paid area/damage, existing
Shield Slam cases, trained wall/doorway controls, ordinary one-point purchases,
sixth-rank rejection, malformed caps and saved-rank immutability. The first wire
regression invocation used `TestAbilityEvent`, selecting no tests; that is not
wire acceptance. Corrected `TestAbilityPayload` adds both Fighter cones and
retains the existing payload variants; its race run passes1.109s.

Logs `/tmp/eidolon-fighter-cone-{server-red,server-red-corrected,server-green,server-final,client-red,client-green,client-expanded,client-final,lint-final,wire-regression,wire-final}-20260912.log`.

Full hosted regression, native purchased-area/impact demonstrations for both
skills and live version acceptance remain required. Four-role dungeon clear,
earned progression, Earthshaker's remaining area consumer and the rest of the
160-talent audit remain open. The shared client area reader still uses canonical
IDs only; audit legacy offline aliases separately rather than claiming a complete
legacy-build migration from these tests.

Proposed1.1.0 notes: “Shield Slam and Sweeping Strike area upgrades now match
their visible cones. Sweeping Strike honors damage training, and offline cleaves
respect floor height, walls and friendly targets.”
