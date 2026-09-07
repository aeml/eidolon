# Next 1.1 progression comparison — earned melee dungeon entry and completion

Queued after the 1.0.40 candidate's verification. This does not replace the
full roadmap, all-class/all-realm dungeon matrix or physical-phone gates.

## Evidence motivating the next step

The retained earned Wizard run completes all four Verdant bosses, manual Earth
chapter turn-in and saved raid access in 31.4 minutes. Opening/collection routes
already have all-four-class evidence. The full generated Fighter route passed
earlier with level-100 preparation; it is not evidence that a naturally earned
melee build can complete the first dungeon at its entry level.

Current QA explicitly restricts `EIDOLON_E2E_FRESH_READY=1` to Wizard in
`fresh-opening-gameplay.spec.js`; `clearEarnedVerdant` also asserts Wizard.
`fresh-ready-route.js` buys Intelligence, Fireball Mastery and Control & Utility,
then uses `createEarnedWizardDefense`. Merely changing `EIDOLON_E2E_CLASS` to
Fighter would fail this fixture, not diagnose game balance.

## Bounded implementation and run

1. Extend the earned preparation policy with an explicit Fighter configuration.
   Use only awarded points and already collected equippable items, keep the same
   capped purchase budget, and select an actually unlocked melee specialization
   through normal UI. Preserve the Wizard branch and its existing regressions.
2. Extend readiness and full-dungeon drivers to dispatch the appropriate class
   preparation/defensive input strategy. Do not reuse Wizard-specific spacing,
   Shield assertions or Intelligence allocations for a melee build. Retain
   movement, attack, cooldown, floor and server-result checks.
3. Run one clean disposable Fighter through opening, collection, ordinary
   contracts, earned dungeon entry and the complete generated Verdant route.
   No level/item/stat/rank grants, encounter teleport, direct health edits,
   forced quest completion, debug kills or readiness cheats.
4. Require all four boss deaths from actual combat, encounter-room completion,
   recall/re-entry persistence, manual Ilyra reward and saved Rootheart raid
   access. Record level/build/seed, deaths, recovery, accepted defensive casts,
   time, loot/rewards, browser errors and exact clean source.
5. If it fails, distinguish a driver assumption from targeting, progression,
   encounter or balance defects with retained observations. Do not lower
   encounter difficulty or bypass story gates simply to make QA pass.

One successful Fighter run strengthens the melee/ranged comparison; it does not
close the remaining Cleric/Rogue, realm, seed, party or human-discovery matrix.

## Driver implementation — September 7

The class-specific preparation now retains Wizard Intelligence/Fireball/branch C
and adds Fighter Strength/Whirlwind Mastery (`FTR_03`)/Shield & Mitigation branch A.
Both use normal UI, at most five earned stat allocations and five total mastery
ranks, existing loot in empty equipment slots, and fresh-login persistence checks.
Fighter expectations follow actual unlocks: Whirlwind 10, Shield Slam 20,
Iron Fortress 30, Guardian Roar 40. The earned dungeon route requires the skills
available at entry; the prepared level-100 route retains its four-skill assertion.

Ordinary hunt inputs use observed cooldowns and resolved mana costs, record
accepted/rejected casts, and leave melee contact attacks uninterrupted by repeated
Charge. No Wizard retreat strategy is applied to Fighter. The dungeon driver
retains ownership of its own melee hotbar inputs; observers do not double-cast.
The existing full-clear, first-boss damage, all-room, death, manual-reward and
saved raid-access gates remain in place. Runtime/game balance is unchanged.

Initial four-suite regression: **45 tests pass in 0.618 seconds**. Final full
client regression, including the added driver tests: **202 suites / 2,999 tests
pass in 88.342 seconds** (`/tmp/eidolon-earned-fighter-full-client.log`). Final
lint and whitespace checks pass. No runtime/server changes were made in this
checkpoint. The complete earned Fighter browser run is pending; this is
implemented QA support, not yet successful earned-melee gameplay evidence.

### First attempt and empty overworld marker correction

The clean `0a92c71` run passed opening, collection and saved preparation, but
recorded no hotbar casts through 50 Skeleton kills. Fresh login retains a null
instance type; same-world recall does not send a new instance-enter event.
The Fighter hook incorrectly excluded that ordinary overworld state. The attempt
was stopped intentionally (session `98662`, exit 130) and its log retained;
disposable cleanup and credential scan pass. This is a driver failure, not a
Whirlwind combat diagnosis or a complete earned run.

New actual-callback regressions fail for null, undefined and empty markers before
the correction (**3 failed / 6 passed in 0.834s**). Normalize the marker with the
same overworld fallback used by the game, preserving the separate dungeon driver.
The complete corrected earned route must be measured from a fresh clean checkpoint.

After the correction, **54 focused tests pass in 1.204s** and the full client
suite passes **202 suites / 3,004 tests in 98.525s**. Lint and whitespace pass.
Logs: `/tmp/eidolon-earned-fighter-null-{before,after,full,lint}.log`. The separate
critical-talent diagnostic deliberately remains failing; it is not a runtime
change or part of this earned driver's skill selection.
