# Unbreakable Grip Mastery — 1.1.0 candidate

Grip is an existing non-damaging pull and root. FTR_15 previously promised and
stored a damage multiplier with no damage consumer. Following the existing
Iron Fortress and Guardian Roar utility-mastery correction, preserve the saved
ID, five ranks and one-point price, but apply +4% root duration per rank.

Base control remains one second; Mastery alone reaches 1.2 seconds. Generic
Crowd Control Drills and Breakthrough add their existing duration bonuses,
reaching 1.55 seconds with all three capped. Resolve the duration at cast time;
later build changes do not resize a running root. The pull endpoint, ordinary
attacks while rooted, immunity, wall rules, mana and cooldown remain unchanged.
No damage, silence or stun is added. Client tooltip/metadata, authoritative
duration and offline paid casts agree; the existing root replication needs no
new protocol fields.

## Evidence

Actual paid server RED1.463s: trained rank1/5 durations did not increase; ordinary
rank0 controls passed. Normal purchases succeeded but the saved Mastery had no
root effect. Offline RED5fail/2pass1.315s, including incorrect talent metadata.

Corrected focused server race8.579s covers rank0/1/5 × generic0/5, normal five
one-point purchases and rejected sixth, malformed/foreign rank exclusion,
immutable stored maps, captured deadlines, unchanged HP/pull/stun behavior, and
existing paid duration, wall, near-target, immunity and rooted-attack checks.
Client four suites88PASS2.139s cover actual paid offline casts, persisted
deadlines, bounded metadata, Fighter duration/economy and Juggernaut regression.
Full lint and whitespace checks pass. Logs:
`/tmp/eidolon-grip-mastery-{server-red,client-red,server-green,client-green,lint}-20260912.log`.

Hosted/full regression, native purchases, dungeon combat and deployment remain
open. This is specifically the missing Mastery consumer, NOT a claim that all
Grip issues are fixed. The next Grip work still includes Technique's unused
range bonus and offline selection parity (planar cursor/range, body padding,
hostile/instance/wall admission before spending resources). Those issues are
not excused by this focused pass or removed from the full talent audit.

Proposed 1.1.0 patch note: “Unbreakable Grip Mastery now extends its root instead
of advertising damage on a non-damaging ability. Existing ranks carry over.”
