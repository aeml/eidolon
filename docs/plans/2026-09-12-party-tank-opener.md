# Four-role dungeon rehearsal: confirmed tank opener

The previous four-role native run (party09121010, frozen e39599d9) died to a
Skeleton pack before any boss. It demonstrated real healing and town recovery,
not a complete clear. Inspection found that the promise to let the Fighter
engage first was implemented as one input iteration. That iteration may only
start approaching an enemy; it does not prove any tank damage or threat before
the ranged damage roles attack. This is a test-strategy defect, not proof of
the sole cause of the prior death or a justification for changing boss balance.

The observer now retains outgoing server damage receipts per target. Wizard
and Rogue wait for a positive Fighter damage receipt on the current enemy
before issuing offensive/buff inputs. Other-target damage, defensive cast
acknowledgements, zero damage, invalid values and another player's damage
cannot unlock the opener. Healer actions and every role's warning escape
continue independently. The Fighter keeps its ordinary driver, legal level30
loadout and existing combat progress watchdog; an unattackable target still
fails rather than being bypassed or granted threat.

No game state, resources, damage, cooldown, dungeon seed, boss requirements,
survival checks or completion deadlines are relaxed. Guardian Roar remains
unavailable at level30. A landed opener does not prove sustained aggro; retained
per-target receipts improve diagnosis of any subsequent loss of threat.

## Verification

New observer test initially failed for the missing helper module; this is an
authored contract RED, not an additional native reproduction. Six focused
suites / 160 tests pass in 2.862 seconds, including damage inputs, independent
role scheduling, healing, warnings and Fighter skill selection. Full lint,
asset preparation and whitespace checks pass.

Logs `/tmp/eidolon-party-opener-{red,green,lint,assets}-20260912.log`.
Native four-role full clear, individual credit/manual quest turn-ins and fresh
Water handoff remain required. This source is prepared separately while the
single native browser slot is occupied by the Wizard repeat-character run.
