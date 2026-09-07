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
