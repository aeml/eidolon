# Shield-branch tank threat — unreleased balance candidate

The second four-role native run on `766486cf9d61228b527e3b6584339428ad44a9e6`
failed after 9.6 minutes. Rootbound Warden was last observed at 1,278 HP before
the Rogue died during a move-only dodge. Session 37298 is terminal exit one.
The complete archive is `/tmp/eidolon-four-role-pointer-failure-c8l4uB`; the
original credential scanner sanitized two report files. The script removed only
its owned disposable services; no remaining `fourrole-pointer-20260911` containers.
Seed `-9168889736000078647`, generator 2, Normal, no fallback. Not a full clear.

New observations rule out the prior melee-dagger theory: recent Rogue attacks
had verified boss hover, 20.5-unit basic reach and no movement target. The boss
repeatedly closed to about 7.4 units of the stationary Rogue and dealt 184 damage.
The final 184 hit coincided with a warning impact. Ten Rogue early escapes were
recorded, but not every dodge succeeded. These observations support pursuit and
endurance investigation; they are not a server threat-table trace.

Whole-run damage/taken: Fighter 5,929/2,167; Rogue 7,516/5,502; Wizard 5,007/350.
Cleric healed 6,232 allies' HP, took 920, used 8 Guardian Embrace / 15 Healing Light,
and ended with 6 mana. Fighter used 12 Shield Slams / 12 Whirlwinds / 4 Iron
Fortresses / 2 Charges. The healer's final range/resource decisions remain in the
archive. No role, death, individual-credit, manual-turn-in or persistence gate is
removed because this attempt failed.

## Balance decision

Shield Slam's shield-branch description promises a threat role, but its cone
handler supplied the ordinary 1× damage threat multiplier. Guardian Roar is only
available at level 40 and its existing boss-taunt set gate is intentional.

This candidate gives Shield Slam the same 2× damage-based threat multiplier
already used by Sweeping Strike. It changes no damage, mana, cooldown, cone,
Fortify absorption, crowd-control immunity, or Guardian Roar/set behavior. It
does not force a boss target or guarantee a tank keeps threat without fighting.
The skill description explicitly distinguishes threat from damage.

## Verification

Paid-cast cases check all three runes and base skill, normal and boss-sized
enemies, immune/non-immune targets, exact unchanged damage/payment, Fortify
absorption and increased threat against a competing damage-role entry. Unhit
targets behind walls/outside the cone/dead/friendly/in another instance receive
neither damage nor threat.

Initial probe mixed real 1× threat failures with invalid enemy Arcane Shield
fixtures: server Arcane Shield absorption applies to player recipients, not
enemies. Those fixture assumptions were removed, not called gameplay fixes. A
later test-only spatial-map call signature error was corrected using the actual
Remove/Add API, including instance changes. Original failure logs are retained.

Final focused race result is `/tmp/eidolon-shield-slam-threat-final.log`.
Client Shield Slam/rune/duration and party-pointer checks passed 3 suites / 79
tests (1.064 seconds), plus lint. Full regression and the complete native four-role
run remain required before publication. Time Warp's full run is separate and
must finish without source changes or a competing full/browser run.

Logs: `/tmp/eidolon-shield-slam-threat-{red,focused,final,client,lint}.log`.
This is not live, not proof of balanced dungeon completion, and not completion
of the 1.1–1.10 roadmap. Separate remaining consumer found during inspection:
Shield Slam's Mastery damage multiplier is not used in its current raw-damage
calculation and needs a paired server/offline investigation; this threat-only
candidate deliberately does not claim to fix that saved investment.
