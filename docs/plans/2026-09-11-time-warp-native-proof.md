# Native Time Warp acceptance route — prepared, not yet passed

`EIDOLON_ISOLATED_QA_ROUTE=time-warp-area` runs the new two-process System Chrome
route against disposable loopback services. A phone-layout Wizard selects branch
C, and a second normal player walks to 16.5–19.75 units away: outside base
15+body-padding but inside trained 18.75+body-padding. These are witnessed ground
inputs, not a teleport or direct entity-position write.

The intended assertions are:

- Base cast reaches self but not that ally; accepted wire and both clients'
  actual caster-centered rings agree at 15 units.
- Fifteen talent purchases use ordinary phone UI: five each in Volatile Insight,
  Mana Geometry and Prismatic Control, within level100's twenty-point budget.
- Low- and high-quality casts reach the same ally at 18.75 units. Both clients
  observe the cast ring, trained duration, normal expiry and removal of attached
  haste effects. The recipient's speed, attack interval and CDR return to the
  recorded baseline. CDR expectation preserves the independently active town
  Well Rested multiplier/cap rather than disabling the requested recovery loop.
- A fresh login retains all purchased ranks. This is prepared functional proof,
  not earned-leveling or physical-phone acceptance.

The only functional preparation commands are the existing allowlisted level
and animation-readiness commands. No direct ability call, fabricated network
command, clock advancement, state mutation, forced buff or forced kill is used.
Message observers capture evidence after the real handler runs.

ESLint, shell syntax and Playwright discovery passed (one test); this is not a
native pass. Run only after full integrated regression52148 terminates and the
GPU/browser queue is free. Application source matches `a57fb362`; the added test
and isolated-route wiring have not changed runtime behavior or production.
The route is standalone during validation; add it to the appropriate regular
release gate once its real execution is accepted. Do not substitute it for the
full four-role dungeon clear, manual quest, saved-build or full-roadmap gates.
