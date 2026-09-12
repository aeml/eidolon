# Ranged positioning in the four-player dungeon playtest

Independent-input run8533 failed at the first Warden on seed7159223432214705865:
Rogue took repeated184damage melee hits at7.44–7.48units without active warnings;
the healer was20.344units away at death with387mana. Retained archive
`/tmp/eidolon-party-independent-failure-5Qgzuf`. Earlier received heal events
already disproved the suspected missing-heal-packet explanation. Neither run
proves a clear or acceptable final balancing.

This candidate changes only playtest movement. After an actual Fighter damage
receipt, Wizard/Rogue seek a firing position inside their real target-padded
basic range and the living Cleric's actual heal range. They hold that position
until the boss closes or healer falls out of reach. Candidate destinations and
complete walking segments must pass encounter, floor and body collision checks;
no verified path means no invented movement. New warnings retain priority.
Moves are ordinary move-only ground clicks within each player's existing serial
worker, with no jump fallback, forced input, damage/stat grant or boss changes.
Recent planned and observed positions are retained separately from success.

Unit tests cover melee departure, support reach, stable firing positions,
obstacles, blocked geometry and invalid inputs. Initial tests caught overly
restricted destination rings and one fixture whose joint destination required
more than the allowed12unit step. The search now includes its full two-unit
holding band; the reachable-support fixture uses a genuinely reachable start.
The12unit bound and full-path rejection are unchanged. Six expanded suites
146tests passed2.054s; lint/assets/diff results are recorded in
`/tmp/eidolon-party-ranged-spacing-{tests,expanded,lint,assets}-20260912.log`.
Full native four-player replay is required; no clear/quest-credit/Water-handoff
acceptance follows from these planning tests.
