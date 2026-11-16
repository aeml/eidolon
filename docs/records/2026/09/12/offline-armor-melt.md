# Offline armor reduction — September 12

Development-only follow-up to Wizard damage parity (`aa1ba963`). This is not a
release or full-roadmap acceptance record.

## Findings and changes

- Offline Scorch Beam subtracted five from `stats.defense` permanently. Repeated
  casts stacked, while stat recalculation could independently replace the value.
  The server instead uses one flat five-point reduction with a five-second
  duration, extended by the caster's applicable duration training.
- Store the reduction separately from equipment armor. A new beam refreshes
  rather than stacks it. Recipient updates expire it even during a longer stun.
  Remote/multiplayer recipients cannot receive this offline mutation.
- Ordinary offline basic attacks ignored armor entirely. Their actual impact
  now subtracts effective armor before the existing variance/outgoing effects,
  critical roll and recipient shields. A low variance roll cannot turn the
  minimum one-point hit into zero. Existing offline variance remains; this does
  not claim complete offline/server damage parity or change server balance.
- Backstab uses effective armor before its Eviscerate rune's integer halving.
  Basic attacks retain the server's named boss/Seraph half-armor rule. Spell
  damage is not universally reduced by physical armor.

## Evidence

- Initial regression: 12 failures / 3 controls, 0.719 seconds in
  `/tmp/eidolon-offline-armor-red-20260912.log`. Two Backstab failures were
  fixture admission errors: the Rogue stood outside Backstab range. Moving
  that test's Rogue within range fixed the fixture, not the game admission rule.
- First implementation: 13 passing / those 2 fixture failures, 0.540 seconds,
  `/tmp/eidolon-offline-armor-green-20260912.log`.
- Expanded focused family: **7 suites / 252 tests passed**, 2.042 seconds,
  `/tmp/eidolon-offline-armor-family-20260912.log`. Actual paid beams verify
  ranks 0/1/5, expiry while stunned, refresh, and equipment recalculation;
  actual Backstab/basic impacts verify mitigation and critical/shield ordering,
  including expiration during wind-up. Boss type mapping is helper-tested,
  not an earned boss encounter acceptance.
- Full ESLint passed, `/tmp/eidolon-offline-armor-lint-20260912.log`.
- Existing authoritative paid debuff/actual follow-up attack tests passed
  three times under Go race detection, 1.484 seconds:
  `TestPaidEnemyVulnerabilityAndArmorDebuffsExpire` and
  `TestExpiredEnemyDebuffNoLongerAmplifiesActualAttack`.
  `/tmp/eidolon-offline-armor-server-20260912.log`.
- Existing `TestTalentDurationWizardTargetStatuses` passed three times under
  race detection, 3.595 seconds,
  `/tmp/eidolon-offline-armor-duration-server-20260912.log`.

## Remaining acceptance and follow-up

Combined full client/server regression for this branch and its pending
Wizard/Time Warp parents, native/browser checks, earned balancing and publication
remain required. No competing local full/native run was started while release
63's required self-hosted gameplay job was active.

The audit also found that offline Shattering Charge only displays armor-break
feedback: `Fighter.js` still has a commented-out placeholder at impact. It needs
its own actual paid movement/impact tests and a real timed armor-reduction
consumer, including cast-time duration training and authority/target filtering.
Do not treat that skill as fixed by Scorch Beam's helper. Its other geometry,
rune and damage behavior also needs comparison with the server.

The complete 1.1–1.10 scope remains open. Soak remains off; normal release CI
continues unchanged.
