# Four-role tank rotation follow-up

The native run at `ab0ac2be` reached Rootbound Warden after all four level-30
roles entered Normal Verdant and completed a real town recovery/resume. It
failed when the Rogue died; no boss clear, final quest credit or Water chapter
acceptance is claimed. Seed: `-8994194291653967333`, generator 2, attempt 0.
Evidence is archived at `/tmp/eidolon-party-warden-failure-j2v94y`.

The boss fight lasted 167.89 seconds before the survival assertion failed.
Last periodic boss HP was 1,759 of 15,000, not a confirmed final HP reading.
Across the run, the Fighter dealt 5,819 damage and used 13 Whirlwinds and
11 Shield Slams; the Rogue dealt 7,109 damage and took 3,496. The Cleric
provided 5,021 effective ally healing (4,543 during the boss), ending with
30 mana. These observations do not establish a single cause of the failure.

Inspection found the party tank reused the solo rotation, prioritizing
Whirlwind over the extra-threat Shield Slam and spending mana without saving
the cost of the next Slam. The party-only policy now keeps defensive skills
first, then prioritizes Slam and reserves its resolved cost before optional
Whirlwind damage. Basic attacks continue while saving mana. It does not grant
the level-40 Guardian Roar to the level-30 party, invent equipment/resources,
change enemy stats, or weaken survival/credit/turn-in assertions. Solo policy
is unchanged. The route reads actual configured skill costs from the client.

Regression evidence: new policy assertions failed 4 cases before the change;
afterward six suites/90 tests passed in 2.593 seconds. Lint, client asset
preparation and diff checks passed. Logs:
`/tmp/eidolon-party-tank-priority-{red,green,lint,assets}-20260912.log`.
Native verification remains required; this is a QA tactics correction, not a
claim that tank balance, the full dungeon gate or 1.1.0 is complete.
