# Four-class earned controls — QA implementation, not class balance approval

The first-hour driver previously supported only Fighter and Wizard. Rogue now
uses the existing collision-aware ranged spacing planner under its actual class
identity, without Wizard shielding. Wizard's public planner wrapper retains its
class restriction. Cleric retains basic/Spirit Guardians combat and can aim an
ordinary Healing Light hotbar cast at itself only when unlocked, affordable,
off cooldown and below65% health. No healing, mana or skills are granted by QA.
Before level ten there is no Healing Light to cast.

Opening spacing now covers both ranged classes, and investigation approaches use
the actual class driver rather than Wizard-only defense. Later normal preparation
has real Rogue Dexterity/Utility and Cleric Wisdom/Pure Healer profiles, with
actual mastery IDs and level10/20/30/40 branch unlocks. Existing point budgets,
ordinary UI purchases, empty-slot equipment and save checks are retained. These
are deliberately simple earned builds, not comprehensive use of every unlocked
skill or a claim of optimized raid performance.

Initial focused83696 correctly failed to load the new Cleric driver because its
helper import pulled Playwright into Jest's browser-like environment. The unit
harness now mocks only that browser helper. Corrected35571 passes75tests/four
suites/1.206s and full lint/diff checks, including class separation, locked/free
heal prevention, cooldown/mana gates and earned preparation boundaries.
Full client regression and actual all-class opening/hunt/dungeon play remain due.
No production source, patch number, combat balance or0.01 regeneration changed.

Full client10683 ended with230 suites/3411 tests passing and one suite failing:
FreshInvestigationCombat still mocked the replaced Wizard-only factory. Its mock
now uses the actual class factory and asserts the class plus target passed to
defense before ordinary attacks. Corrected64317 passes82 tests/five suites in
2.166s, plus full lint. A fresh full regression is required on this correction;
the failed full run is not recorded as a pass.
