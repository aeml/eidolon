# Recipient support-buff expiry

Unpublished follow-up to Cleric duration source 3673f5f8, separate from the
active Alpha 1.0.62 release. Full roadmap and native party gates stay open.

## Reproduction

Actual paid Resolve, Zeal and Guardian-rune Divine Intervention casts applied
to both player and NPC recipients. Six NPC cases, with/without stun, retained
expired flags; player and unexpired controls passed. Server RED 0.005s in
`/tmp/eidolon-recipient-buff-server-red.log`. Expiry was player-only.

Offline paid support casts reproduced four failures out of six: stun paused
both blessing timers and Divine Intervention; even without stun the expired
rescue retained its active flag. Client RED 0.592s in
`/tmp/eidolon-recipient-buff-client-red.log`.

## Repair

Shared recipient expiry handles Resolve, Zeal, Divine Intervention rescue and
its independent Guardian protection on NPCs and players. Exact/missing
deadlines clear flags and stored deadlines, recalculating affected stats once.
The shorter Guardian deadline does not clear the longer rescue window.

Actor buff timers now run before the stun early return, like recipient debuffs
and damage/healing over time. Crowd control still suppresses movement; it no
longer extends existing buffs. Removed the old stun block rather than running
timer blocks twice. Offline rescue expiry clears its active flag; multiplayer,
remote and engine-authoritative states retain server-owned rescue/shield flags.

## Focused evidence

- Initial repaired server three-repeat race: 1.034s PASS; offline six paid
  support cases: 0.591s PASS.
- Expanded regression initially found a test-fixture defect: a naked target's
  zero derived defense cannot increase under a percentage bonus. Added a real
  equipment defense stat to both prepared recipients and boundary controls;
  retained the assertion that paid Resolve actually increases defense and then
  restores it. This was not an additional runtime defect. Two JS multiline
  call lint failures were corrected without changing assertions. Failed logs:
  `/tmp/eidolon-recipient-buff-{server,client}-broad.log` and
  `/tmp/eidolon-recipient-buff-lint.log`.
- Final three-repeat Go race: 1.157s PASS, including actual paid recipient
  lifecycle, real stat restoration, exact/missing/future boundaries, independent
  Guardian deadline, Cleric duration/Renewal/blessings and paid vulnerabilities.
- Final client 5 suites / 109 tests: 1.959s PASS; lint PASS. Includes actual
  post-expiry ordinary damage and lethal damage (no expired rescue), once-per-
  update timers with/without stun, movement stability, replicated state guards,
  and prior debuff, Cleric duration and Arcane Shield regressions.
  Final logs `/tmp/eidolon-recipient-buff-{server,client,lint}-final.log`.

Full regression required before integration or publication. These tests do not
prove native observer/save/phone/full-party completion or all talent/rune parity.
The cancelled soak stays off; active release Chrome gates retain the GPU.

## Unreleased patch-note draft

Support buffs now expire correctly on friendly NPCs. Stuns no longer pause
offline buff lifetimes, and an expired Divine Intervention can no longer rescue
a character. Its shorter Guardian protection and longer rescue window expire
independently.

## Same recipient gap in Fighter and Wizard support

Paid Guardian Roar and Time Warp casts reproduced four additional NPC expiry
failures (with/without stun); player and active controls passed. RED0.012s:
`/tmp/eidolon-recipient-support-other-red.log`.

The shared helper now covers these two support buffs too, replacing their old
player-only expiry blocks. All five skills retain actual payment/application,
nonzero equipped defense or speed/cadence benefits and baseline restoration
assertions. Exact/missing/future and repeat-update controls cover simultaneous
support buffs. Three-repeat expanded Go race15.459s PASS, including Guardian
Roar and Time Warp regressions: `/tmp/eidolon-recipient-support-final.log`.

Unreleased note addition: Guardian Roar and Time Warp also expire properly on
friendly NPCs. Full native/save and remaining consumers stay open. Read-only
next lead: Renewal's tick handler appears player-only despite accepting NPCs;
reproduce it before changing it, and do not claim this expiry patch fixes it.
