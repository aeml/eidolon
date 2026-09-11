# Shield Slam stun training — local implementation stage

Status: server/offline stun consumer repaired and focused tests pass. Not
integrated into the release candidate, not deployed, and **not** completion of
the full Fighter duration/copy or160-talent gate.

Starts from the confirmed d70ed1bc diagnostic. The separate enemy/NPC stun
lifecycle repair is committed independently; ordinary stun timers were not
expiring for enemies and their AI kept moving, so timer scaling alone cannot
establish useful or balanced gameplay.

## Implemented contract

Apply existing server definitions FTR_30(+4% per rank) and FTR_37(+3% per rank)
additively to Shield Slam's stun after Concussion's authored+1 second. Rank-zero
ordinary stun stays1.5s; Concussion stays2.5s. Both rank5 talents together yield
2.025s ordinary/3.375s Concussion. The actual server cast snapshots this duration
once. Offline casts now use the same stun computation and Concussion rule.

No saved rank IDs, rank limits, damage formulas, cooldowns or mana costs change.
Reverberation and Fortify retain their own existing behavior; this does not
repair the separate Fortify shield-duration/offline-rune gaps. Offline targeting,
geometry and immunity parity are also not inferred from this timer change.

The older descriptions still disagree with the authoritative duration bonuses:
FTR_30 promises flat stun/slow seconds, FTR_37 armor penetration. This stage
preserves the existing numeric server definitions and saved investment rather
than silently adding an unrelated new penetration mechanic. Reconcile the full
intended scope and update descriptions alongside all affected consumers before
shipping the talent change; do not advertise all buffs/debuffs as repaired by
one Shield Slam consumer. Other authored Fighter deadlines remain open.

## Evidence

- Original78560 diagnostic failed all four trained rank5 controls, while ordinary
  damaging paid casts succeeded. That red evidence remains in the audit branch.
- Server94869 focused race passed game16.152s:96 actual casts across all ranks0–5,
  each generic talent, composed talents and unrelated Shield Slam mastery, with
  all four rune variants. Checks damage/stun/cost, brackets expected deadlines
  by real cast start/finish, preserves normal CDR and cast-time snapshot.
- Client86127 passed25 tests/1suite1.265s, exercising96 ordinary offline casts
  across that matrix plus malformed/clamped ranks; focused ESLint and diff check
  passed. No multiplayer simulation is added; the existing early return remains.
- Initial tests assumed unmodified6s cooldown, but prepared characters have
  normal stat CDR. Corrected assertions retain6*(1-existing CDR), without changing
  runtime cooldown behavior. Initial failures are recorded, not hidden.
- Expanded lifecycle race88626 passed game25.359s including this duration matrix
  and existing Seraph, poison, dungeon enemy movement and attack-impact tests.

Logs `/tmp/eidolon-fighter-stun-duration-{client,server}-final.log` and
`/tmp/eidolon-enemy-stun-expanded.log`. Full client/server regression, native
paid-training/reconnect/timer replication, actual party balance, copy resolution
and integration/release gates remain required. No native GPU run launched while
canonical production QA uses the shared machine.
