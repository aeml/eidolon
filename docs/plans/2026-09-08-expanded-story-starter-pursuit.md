# Keep the expanded Chronicle on the verified combat baseline

The isolated 31-chapter campaign already contains the two-second-base player
cadence, avoidable enemy melee impacts, the 0.01 regeneration rate, smaller
opening reward and dead-only mana recovery. It lacked the independently tested
starter pursuit correction from release47 candidate62791a5.

This port adds only that runtime correction and its four original regressions.
Ordinary level1–9 overworld Skeletons defend a60-unit home encounter and walk
back at normal speed when the traveler leaves it. They keep damage taken and
remain attackable. Elites, summons, higher-level enemies, other families and
instances are unchanged. The existing pursuit/admission/impact rules inside
the home encounter remain intact.

No old15-chapter catalog, reward amount, quest count, version metadata or saved
progress is copied over the expanded campaign. In particular Those Who Kept
the Watch still requires40 credited level3+ Skeletons, and the authored later
expeditions, investigations, dungeon/raid gates and manual Ilyra conversations
remain. The current XP curve is not silently replaced by the curve2 prototype.

24805 focused server race passed3.696s, covering starter behavior, base cadence,
passive regeneration and matching enemy-impact tests. Full server regression
and a new uninterrupted earned story route remain required. The separate
15-chapter Wizard/Fighter collection passes do not establish that this expanded
campaign is playable or that its full leveling route reaches every entry gate.
