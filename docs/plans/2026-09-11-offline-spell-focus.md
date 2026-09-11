# Offline Spell Focus parity — unreleased candidate

The existing server contract is a paid30MP/45s-cooldown buff lasting15s, extended
by Prismatic Control. It multiplies the next committed damaging spell by2.5;
Teleport and other utility casts do not consume it. This repair follows that
contract, without redesigning its balance or adding a new multiplayer bonus.

New actual offline casts reproduced11failures/21cases in1.999s: the handler
overrode45s with20s, did not use duration training, spent resources before its
unlock check, consumed the charge on Teleport and refresh, never cleared the
active charge at timer expiry, and consumed it for Fireball without multiplying
the emitted projectile. Source/recipient tick order and actual emitted projectile
damage are exercised, not just new metadata.

Changes:

- Preserve Actor's canonical trained cooldown/mana admission. Check non-base
  Wizard skill unlocks before payment or charge consumption.
- Snapshot trained15s/18s duration using the existing Wizard duration consumer.
- Match the server's explicit damaging-skill list for charge consumption;
  preserve utility casts, rejected casts and ordinary refresh behavior.
- Apply the charge to Fireball's real outgoing projectile, once. Subsequent
  unbuffed Fireball and Dragonfire Lance casts retain their original damage.
- Clear offline active state/multiplier at expiry, including during stun. A
  replica's display timer cannot clear authoritative gameplay state. Wizard
  casting also respects an authoritative owning engine when passed a different
  presentation context.

Evidence:

- Initial three suites57tests passed1.903s after repair.
- Expanded authority tests initially made three incorrect assertions that
  multiplayer prediction must emit no cast visuals. Existing Actor presentation
  is intentionally allowed; corrected tests require no local buff/activation
  while retaining ordinary visuals. This was a fixture error, not a game defect.
- Nine focused suites226tests passed4.914s, session30205 exit0. Covers actual
  Focus casts, Time Warp, shields, teleport, Flame Whip, Wizard visual routing,
  authoritative callouts and buff tracking. Full lint passed18507; later test-only
  additions passed their own ESLint check. Whitespace check passed.
- Logs `/tmp/eidolon-offline-focus-{red,green,focused,final,expanded,lint}-20260911.log`.

Full client regression is now accepted on integrated6eb0b652 (including the party
waypoint correction). Session64864 exit0:355suites/5084tests121.14s plus full lint.
Logs `/tmp/eidolon-focus-waypoint-full-{client,lint}-20260911.log`. Server source
is unchanged from the already accepted build-rejection server tests.

The first full run53029 failed19 stage-timing cases (353other suites passed):
the Time Warp stage added previously was missing from the exact command/stage
fixture. The fixture now includes its execution-order, failure-stop, artifact
scan and cleanup checks; no stages or assertions were dropped. That first run's
137.202s result remains a failure, not the acceptance result.

Native four-role run93038 has ended with a waypoint-observation failure; its
correction and archived evidence are in2026-09-11-party-waypoint-arrival.md. A
new full party route still needs to pass. No native or production acceptance of
Spell Focus is implied by this unit regression.
The broader160-talent audit remains open, including non-damaging utility skills'
placeholder damage Masteries and other missing consumers.

Unreleased patch-note candidate: Offline Spell Focus now respects trained
duration and cooldown, survives utility casts, correctly empowers Fireball, and
loses its damage charge when its duration expires.
