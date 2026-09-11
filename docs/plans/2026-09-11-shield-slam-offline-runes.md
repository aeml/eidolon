# Shield Slam offline runes and stun overlap

This extends isolatedf2c1f468. It is not part of the domain release or accepted
narrow gameplay successor. Full Fighter/native/save/roadmap acceptance stays
open; this is not a new numbered release.

## Reproduction

28706 failed11 of12 ordinary offline cast checks in1.020s. Reverberation/Fortify
were unimplemented; the legacy cone followed mesh facing rather than aim, used
3D center distance, omitted body padding/base damage and lacked hostile/wall/
CC-immunity filtering. The closed-wall negative control passed alone because
the elevated-caster fixture prevented all hits. Log:
`/tmp/eidolon-shieldslam-offline-red.log`.

The new handler follows the server's aimed planar4-unit/90-degree cone and body
edge, blocks dungeon walls and excludes friendly/dead/inactive/remote targets.
Reverberation doubles the existing base-damage-plus-Strength strike. Fortify
adds each eligible outgoing hit (including its ordinary critical) once to the
existing absorb shield and resolves its10s duration at cast time. Misses neither
create nor refresh shields. Remote/multiplayer prediction applies no local
damage/control/shield. The existing receiver consumes capacity and expires
unused capacity through the ordinary update loop.

87684 initial green run had one assertion failure:13.499999999999998 versus
13.5 using exact equality. Corrected to the same8-decimal duration tolerance as
other cases; no runtime rounding change. Added critical/deduplication, missed
cast, three authority modes and stronger-stun cases.71180 PASS113tests/5suites
2.862s plus full lint. Logs:
`/tmp/eidolon-shieldslam-offline-final-focused.log`,
`/tmp/eidolon-shieldslam-offline-lint.log`.

## Authoritative stronger-stun overlap

32032 actual paid Seismic Earthshaker then Shield Slam reproduced the second
cast shortening the stronger stun (raceRED0.612s). The immune-target control
passed. The common Fighter cone now preserves the later existing active stun
deadline, matching the already-repaired Earthshaker/Charge overlap behavior.
80299 passed three repeats under race detection26.798s, including the overlap,
prior Fighter effect/party-duration matrix, Charge overlap, directional dungeon
attacks and enemy stun lifecycle. Logs:
`/tmp/eidolon-shieldslam-overlap-{red,green}.log`.

## Full preceding-source regression

Run65944 completed successfully on frozen2b733533 (runtime825f9b0c):
340 client suites /4771 tests in211.89s and full lint passed. Full Go race
passed: root29.372s, game504.379s, loadtest1.026s, database1.122s and
lifecycle1.039s. Logs `/tmp/eidolon-fighter-rune-full-{client,lint,server}.log`.
This accepts the combined Fighter changes at that exact source, not the later
ability-defense migration. It does not establish native visuals, saved training
or completed class/encounter balance.

## Remaining scope

Native Fortify presentation/absorption and saved training are still needed.
Other Fighter buffs/runes/party/combo parity remain open. Run65944, not the
preceding65176 onf2c1f468, is the full regression for this source.

Separate source-audit question: server applyFinalDamage directly subtracts its
outgoing calculation, whereas basic attacks have receiver-side shielding logic.
Before claiming whole-combat mitigation parity, reproduce actual hostile skill
casts against shields/protection and compare with basic attacks. This document
does not classify that broader interaction as tested/fixed or silently change
the receiving pipeline in this rune patch.

Unreleased player-note draft: Fighter duration training now affects its buffs
and control effects; Fissure/Aftershock and Shield Slam runes work offline;
Fortify grants usable timed shielding; follow-up stuns no longer cut stronger
stuns short. Publish only with the eventual accepted version and live evidence.
