# Offline Cleric areas and actual observer verification

Follow-up to `95eac97` (accepted online areas) and `88b3e67` (phone combo
readability). This is local work intended for the next release after 1.0.39;
it does not change the queued 1.0.35 source or close 1.1–1.10.

## Implemented

Healing Light now resolves a live friendly target on the ground plane before
its offline presentation, checks direct range and dungeon cover, and falls back
to self when selection is invalid. It retains the shared eight-second base
cooldown, equipment and spell-economy training. Healing uses `30 + 3 × Wisdom`,
equipment/healing training, poison reduction and missing-health clamp; the legacy
invented low-health critical heal and five-second cooldown are removed.

Beacon and normal Divine Intervention → Healing Light use their trained circle
and correct center, with target body padding. Friendly area healing intentionally
passes through walls. Failed casts do not consume the combo; successful
intervening casts, expiry and ability cancellation end it. Mass Revival does not
inherit Renewal/Divine single-target effects. Renewal stores its cast amount on
the recipient for five ticks, continues through stun and never heals remote,
online, inactive or dead actors. Divine cleanses one debuff in server priority.

Offline Radiant Strike uses trained planar cone/body geometry and dungeon cover,
correct base Wisdom coefficient, mastery, Smite/Chains/Purge and actual-damage
set healing. The shared economy retains Technique cooldown training. Damage
continues through the existing offline Actor mitigation path; this is not a claim
that every offline combat modifier matches the complete server pipeline. Other
legacy offline abilities, including Divine Intervention's own buff/heal/runes
and cross-branch combo availability, still need their separate audit.

Online and remote casting remain presentation-only locally. The actual two-spell
Mass Revival sequence is independently covered by the server-backed browser
route, not only the offline unit fixture.

## Evidence

- Initial offline fixture: **18 failed / 4 passed in 0.806s**. It reproduces
  geometry, healing/rune and combo issues, with online non-mutation controls.
- After implementation, six cooldown expectations exposed the fixture's own
  nonzero default CDR, not an implementation failure. They now assert the shared
  reduction rather than assuming zero. An inactive-recipient Renewal assertion
  also needed baseline HP regeneration disabled to isolate the HoT consumer.
- Final focused offline/online/shape suite: **53 tests pass in 1.053s**.
  Includes ranks 0/1/5, scaled target edges, friendly/hostile/dead/inactive
  exclusions, cover, real combo order/expiry/failed attempts, healing arithmetic,
  renewal lifecycle, rune priority/immunity and post-shield set healing.
- Full client regression: **201 suites / 2,973 tests pass in 94.063s**.
  Lint and whitespace checks pass. Server source is unchanged from the earlier
  passing race suite (game 219.529s / post-wire root 8.348s).
- Expanded actual gameplay route: **28.9s pass**, now with a separately launched
  second browser logged in before casts. At rank-zero/high and rank-five/low,
  observer and caster see matching accepted Radiant Strike/Beacon/Mass Revival
  radius and arc, direct healing has no area, healing centers agree and the
  observer's source talent map remains private/empty. Both browser-error checks,
  fresh-login persistence and credential scan pass; temporary services clean up.
  Observer screenshot inspection confirms the compact attributed action label
  and accepted circle are present. This is not a physical-phone performance test.

Logs: `/tmp/eidolon-cleric-offline-before.log`,
`/tmp/eidolon-cleric-offline-after.log`,
`/tmp/eidolon-cleric-offline-expanded.log`,
`/tmp/eidolon-cleric-offline-focused.log`,
`/tmp/eidolon-cleric-offline-full-client.log`,
`/tmp/eidolon-cleric-offline-observer.log`,
`/tmp/eidolon-cleric-offline-lint.log`.
All owned verification processes are terminal.
