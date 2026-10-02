# Alpha 1.61 casino world integration

The casino world milestone preserves the shared Lanternhold venue, separate
full-size floors, physical seating and normal world return. The prepared change
closes door-dialogue lifecycle gaps. It is not deployed; publication follows
accepted 1.59 and 1.60 releases.

## Door and guard improvements

Entry, stairs and exit actions now belong to the character, connection, scene
and floor that opened their dialogue. A retired button cannot enter another
scene, use an expired VIP entitlement or send after disposal. Walking toward a
door is cancelled when its context changes; arrival still requires an explicit
confirmation. Receiving initial floor metadata in town does not invalidate a
valid entrance dialogue.

The public-floor guard retains the explanation that VIP access is required and
disables the upstairs action for non-VIP visitors. These client checks do not
grant access: the existing server still owns entry, proximity and entitlement.
No station counts, wallets, wagers, payouts or monthly EP awards change.

## Local evidence

- Four focused client suites passed 54 checks in 1.802 seconds, covering door
  retirement, delayed arrival, explicit confirmation, floor visibility,
  navigation and map presentation. Full lint passed.
- Two System Chrome cases passed in 7.5 seconds. They exercised native chair
  picking, table controls, phone-sized panel layout, normal camera/control
  restoration and the disabled VIP guard action. Both final renders were
  inspected. These use synthetic venue state and procedural actors; they do not
  prove live multiplayer wagering or authored model performance.
- Six server-authority world tests passed under the race detector in 1.081
  seconds: the required station counts on both floors, shared entry and safe
  return, VIP guard and seat height, full-floor bounds and legacy saves, stairs
  round trips, and prevention of movement or seating through the ceiling.

The rendered checks retain the normal server-request shapes; no production
character, currency or access records were modified.

## Retained venue evidence and boundaries

The [casino expansion](2026-09-20-casino-expansion.md) records the larger venue,
signage, town clearance and 46 stations on each floor: four blackjack, four
Hold'em, two roulette, four baccarat and 32 slots. The
[shared zone record](2026-09-13-shared-casino-zone.md) covers entry and floor
separation. The [1.13 acceptance](2026-09-28-release1-13.md) and final paired
hardware section of the [frame profile](2026-09-27-casino-frame-profile.md)
retain earlier performance evidence; this change does not claim a new capacity
benchmark. The [authored model receipt](2026-10-01-release1-58-3-graphics.json)
remains the separate source of model and equipment checks.

Blackjack and Hold'em edge cases, slot content, cosmetics and economy trust
remain the following 1.62 through 1.70 milestones. Physical-phone party comfort
and campaign pacing remain owner playtest observations. Release defaults,
cumulative notes, exact CI source and independent public acceptance must be
recorded when this milestone is published.
