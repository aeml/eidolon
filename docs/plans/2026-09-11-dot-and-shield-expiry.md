# Wound receiving defenses and shield expiry

Isolated follow-up to the immediate/projectile/periodic defense repairs for
the still-open1.1 gate. This is not deployed in domain release1.0.61, and does
not replace any of the full1.1–1.10 roadmap, native, save or balance requirements.

## Confirmed defects

60706 REDrace0.082s: actual paid Shadow Strike/coated basic attacks applied
bleed/poison, but their ticks damaged HP while leaving shields and reflection
untouched. Four expired/missing-deadline shield cases continued absorbing hits
and retaining their old rune/history; both active-shield controls passed.
`/tmp/eidolon-dot-expiry-defense-red.log` retains this reproduction.

## Repair

- Both status ticks enter a receiver-only impact method with their stored wound
  amount. It does not reroll crits, reread training/equipment or apply inherited
  outgoing bonuses twice. Current receiving reductions, capacity, reflection,
  phase caps, damage events and ordinary death/credit remain effective.
- Retaliation temporarily releases the status receiver lock and restores it
  before returning to the caller. Actual actor lookup/reflection never runs
  while that receiver lock is held. Dead actors cannot receive another impact.
- Shield expiry is checked at the receiving impact, not only a later player
  update. Exact expiry and malformed missing deadlines invalidate the shield;
  capacity, rune and absorbed history are cleared without a break explosion.
  Periodic cleanup and Meteor's Arcane Barrage consumption share that check.
- Manually prepared positive shield fixtures now provide valid deadlines. The
  phase-boundary DoT helper fixtures pass an explicit clock; a missing import
  and old helper signature caused compile-only attempts, not runtime passes.

## Evidence

20981 focused racePASS15.847s (status/expiry plus existing shield/boss/phase/
Meteor cases).27747 broader racePASS20.937s including bleed/poison cadence,
lethal prevention, rewards, training and Dark King phase paths.71929 passed
three repeats3.102s: actual paid status application, stored budgets unaffected
by later guaranteed crit/huge damage changes, partial shields, Sanctuary,
Guardian, invulnerability, lethal reflected bleed, simultaneous prepared wounds
with real paid shields through parallel World.Update, exact expiry, and a real
Arcane Shield→Meteor combo unable to consume a shield that expired in flight.

Logs `/tmp/eidolon-dot-expiry-defense-{green,broad,repeated}.log`.
Prepared clocks/capacity/wounds isolate mechanics; these are not native timing,
earned progression or live acceptance. Full combined server regression remains
required, including the preceding periodic full-run fixture corrections.

## Remaining pipeline work

Do not infer full combat/balance closure: raw versus inherited wound creation
still needs outgoing/PvP budget validation (receiving repair deliberately does
not rescale stored ticks); basic-hit outgoing/receiving ordering, all thorns/set
retaliation consumers and explosive-shield PvP hostility still need repair and
coverage. Full native four-role encounters, actual defensive feedback, saved
talents/runes and broader phone/campaign/roadmap stages remain mandatory.

Unreleased patch-note draft: Bleed and poison respect shields and defensive
reductions. Expired shields stop defending at their deadline, clear stale rune
state, and cannot power a later Meteor combo. Reflected wound damage reaches
its real source without repeating the wound's damage bonuses.
