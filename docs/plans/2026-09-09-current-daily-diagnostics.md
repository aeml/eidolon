# Current-budget optional daily diagnostics

The coordinated progression candidate's production catalog audit confirms
100-Skeleton contracts pay 4,250 XP and 100 gold; 100-Imp contracts pay 18,250 XP
and 200 gold. The legacy optional fresh-hunt/fresh-ready browser diagnostics
still expected 50,000/150,000 XP. Those obsolete expectations are corrected;
both gold receipts are now exact rather than merely positive. The Go content
budget regression also explicitly covers Imp alongside Skeleton.

These changes affect tests only. They do not alter production rewards, accepted
legacy quotes, objective counts, encounter deadlines, actual combat/turn-ins,
reconnect assertions or the complete release command chain. The optional route
still requires actually earned level 30; it is now explicitly labeled a daily
comparison, not evidence that dailies are necessary to finish the campaign.

The separate `fresh-story-ready` gate remains authoritative for the authored
Earth route: all seven pre-dungeon chapters, no accepted/completed daily, earned
level 30, enabled Normal entry and sealed raid access. Its actual four-class
gameplay remains unverified. Corrected constants are not a passing daily route.

Validation: parent4e9cad5 full client passed 266 suites/3,789 tests in144.949s
plus lint under Node24.18.0. After the diagnostic correction, lint and61 tests
covering story-only readiness, isolated route defaults and earned recovery
passed in1.009s. Both coordinated Go budget tests passed with the race detector
in1.038s. Exact logs: `/tmp/eidolon-primary-daily-diagnostics-{tests,lint,server}.log`.
No new optional daily browser playthrough is claimed.

Production accounting audits on parent4e9cad5 passed under Go1.24.5 (1.305s).
The collection simulation's 2,000 seeded trials per realm needed 20.08 ordinary
eligible kills on average and 26 at p90 for eight fragments with pity. These are
simulated drops, not travel/combat timing or earned four-realm acceptance.
Prepared four-boss plus overlapping-daily accounting passed for Normal, Heroic
and Mythic, with daily XP bounded to 25% of boss XP and duplicate claims rejected.
It excludes trash, room rewards, story and sales; it is not a full-run budget or
an earned boss clear. Log: `/tmp/eidolon-primary-finalclock-progression-audits.log`.
