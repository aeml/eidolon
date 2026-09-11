# Cleric effect-duration consumers

Unpublished follow-up to accepted local source a972dafe. This is not part of
Alpha 1.0.62's active release and does not complete the full talent audit.

## Reproduction and repair

Actual paid server casts reproduced 42 trained-duration failures across 14
timers in 0.049s. Baseline, unrelated talent, and already-correct Avenging
Seraph controls passed. Offline paid casts reproduced 13 failures in 0.589s.
Logs: `/tmp/eidolon-cleric-duration-red.log` and
`/tmp/eidolon-cleric-duration-offline-red.log`.

Cleric timed effects now consume the existing matching Technique and generic
duration ranks once, after rune base durations. Applied effects retain the
caster's snapshot after ranks change; party blessings share that deadline.
Renewal retains its per-tick healing and gains whole ticks from extended
duration (7 ticks at 7.75 seconds, with no fractional eighth tick). Explicit
persistent QA lifetimes remain absolute overrides, not multiplied durations.
Seraph's existing duration path is preserved without double application.

Offline consumers use matching metadata with capped, normalized saved ranks
and multiplayer/remote guards. Descriptions now match existing server duration
percentages, rather than promising unrelated range/shield benefits. Saved IDs,
rank limits, and schemas are unchanged.

## Focused verification

- Initial server three-repeat duration regression: 1.096s PASS.
- Expanded three-repeat Go race regression: 17.046s PASS, covering paid
  duration, Renewal ticks, absolute QA overrides, shared party deadlines,
  blessings, healing, Seraph, paid vulnerability, and Rogue duration.
  Log: `/tmp/eidolon-cleric-duration-server-broad.log`.
- Broader client run initially failed two old expectations: trained Radiant
  Chains still expected 2 seconds instead of 2.2, and Mercy Doctrine's exact
  description omitted its existing duration benefit. Corrected these expected
  values while retaining damage, CC-immunity, cooldown and other-copy checks.
  Failed evidence: `/tmp/eidolon-cleric-duration-client-broad.log`.
- Final focused client: 7 suites / 148 tests PASS in 2.641s; full lint PASS.
  Includes actual Renewal delivery, rank changes, padded/unpadded rank aliases,
  invalid ranks, authority guards, duration copy and prior expiry controls.
  Logs: `/tmp/eidolon-cleric-duration-{client,lint}-final.log`.

Full regression is required before integration. Native party completion,
purchase/save/reload, complete offline rune and recipient-buff parity, earned
balance, phones and remaining talent consumers stay open. Keep the GPU free
for the active release's Chrome gates. The soak remains cancelled.

## Unreleased patch-note draft

Cleric duration talents now extend their matching buffs, zones and debuffs.
Renewal gains additional healing ticks when its duration is trained, and party
blessings use the caster's duration bonuses. Talent descriptions show the
duration benefits accurately.

## Full regression accepted on 3673f5f8

74824 terminated exit 0 on unchanged 3673f5f85bb899f5604aa47f96902e4752d0ffe7.
Full client 348 suites / 4869 tests PASS in 162.666s; lint PASS. Go race PASS:
root17.917s/game320.141s/loadtest1.018s/database1.089s/lifecycle1.022s.
Logs `/tmp/eidolon-cleric-duration-full-{client,lint,server}.log`.

This accepts the duration patch for local full regression, not the subsequent
recipient-buff expiry patch, native party/save/phone gates or publication.
