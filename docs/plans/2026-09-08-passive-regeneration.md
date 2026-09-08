# Passive health and mana regeneration — unreleased

Requested September8: set the displayed0.1 per-stat rate to0.01. Inspection
found both authoritative and offline formulas actually used **0.5**, while
the Vitality/Wisdom tooltips advertised0.1. The requested final coefficient
is now **0.01 resource points per second per stat point**, in initialization,
stat recalculation and both tooltips. Relative to the old runtime this is a
98% reduction, not merely10%; do not describe it as an actual0.1→0.01 runtime
change. Ten Vitality/Wisdom now provides0.1HP/mana per second.

The integer server previously discarded every fractional point on every tick.
It now accumulates fractions: ten ticks at0.1 restore one point, rather than
zero forever. Full/dead/disabled resources cannot bank unused regeneration;
health inspection pauses do not stop mana recovery. Offline values retain their
existing fractional representation. Multiplayer clients do not double-regenerate.
Equipment stat and percentage bonuses still apply to the smaller base; the
Regenerative unique's separately advertised1% HP effect and active healing,
potions, room-clear recovery and respawn are unchanged.

Focused client45690 passes62 tests across three suites; full lint23899 passes.
Initial server54557 failed the world-tick fixture because its empty base stats
made50 current HP exceed45 maximum HP, correctly preventing regeneration. The
fixture now has valid base stats. Corrected three-race46937 passes11.513s,
including actual World.Update ticks, fractional sequences, caps, dead actors,
paused health and equipment modifiers. No runtime checks were relaxed.

Full regressions now pass on8aa6ae0: client67493 **219 suites /3,225 tests /
182.603s**; server race24799 **root21.275s /database1.072s /game448.952s**.
Both handles closed; no source changes during either check. The longer server
run was allowed to finish, not restarted. Root-integrated as2580ac2 with the
same runtime/test source. Versioned packaging and deployment remain due.
The in-flight31-chapter Earth browser uses its frozen older regeneration and
cannot establish combat pacing for this new rate. Re-run earned class/campaign
checks after integrating the requested reduction into that candidate.
