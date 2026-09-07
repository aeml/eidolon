# Cleric accepted cone and healing areas

Unversioned follow-up to the phone actor-action checkpoint after preserved
Alpha 1.0.39. This is not deployed and does not close the wider talent audit,
offline parity, phone sign-off, 1.1 or full 1.1–1.10 roadmap.

## Implemented

- Radiant Strike consumes trained `CLR_34` radius (3/3.09/3.45 at ranks 0/1/5),
  retaining its 120-degree cone, hostile target rules, body padding and walls.
- Beacon consumes trained radius 5/5.15/5.75 at the actual healing target.
  Normal Divine Intervention → Healing Light resolves Mass Revival at the caster
  with radius 20/20.6/23. Friendly circle healing retains its through-wall policy.
- Accepted ability events publish radius, arc and resolved healing target/center.
  An explicit `shapeResolved` field distinguishes single-target healing from
  legacy events that lack area metadata. The outbound WebSocket payload retains
  this distinction, including when zero radius/arc are omitted from JSON.
- Client and observer geometry consumes the accepted shape without private
  ranks/runes. A changed healing center replaces the predicted ring even if the
  radius is unchanged; a resolved direct heal removes a stale Beacon prediction.
  Reconciliation does not replay animation or apply gameplay effects.
- Mobile, desktop and pending-target Radiant Strike intent uses trained range,
  planar distance and the replicated target body radius rather than render height.

## Evidence and corrections

- Promoted actual-dispatch tests retain normal selected-branch Mass Revival
  detection and add ranks 0/1/5, scale 1/4, just-inside/outside boundaries,
  cone angle, dead/other-instance/wrong-allegiance exclusions, open/closed walls,
  selected direct-heal center, Renewal and single-debuff cleanse controls.
  Expanded focused server tests pass in **1.337s**.
- The first real-server phone route fails in **5.0s** because the outbound
  `AbilityPayload` conversion dropped `shapeResolved`. A targeted protocol test
  reproduces the missing zero-radius distinction in **0.007s** before repair.
  The game-event unit test alone had not covered this conversion.
- After repairing the payload type/conversion, actual hotbar casts pass in
  **21.4s**: rank-zero/high and rank-five/low Radiant Strike, Beacon and normal
  Mass Revival, plus direct single-target healing. Actual boundary mesh radius
  and healing center agree with accepted events; fresh-login training persists.
  Prepared level and readiness are disposable QA conditions, not earned campaign
  progression. No forced combo flag replaces the actual two-spell sequence.
- Full server race suite passes (game **219.529s**, original root **11.953s**).
  After the root-only wire repair, root race suite passes again in **8.348s**;
  the game package is unchanged from its passing race run.
- Initial full client run catches one obsolete exact Beacon visual assertion
  lacking its explicit full-circle arc. After updating that expectation, all
  **199 suites / 2,936 tests pass in 100.639s**. Focused input/shape tests pass
  **18 tests in 1.256s**. Lint, shell syntax and whitespace checks pass.
- Two-account phone support regression passes in **17.6s**: deliberate selected
  ally receives authoritative Healing Light and Divine Intervention in 390×844,
  844×390 and 568×320, caster health stays unchanged, and leaving the party resets
  selection. `/tmp/eidolon-cleric-final-party.log`. All local QA processes closed.

Logs: `/tmp/eidolon-cleric-final-area-expanded.log`,
`/tmp/eidolon-cleric-final-area-gameplay.log` (retained failure),
`/tmp/eidolon-cleric-final-area-gameplay-after-wire.log`,
`/tmp/eidolon-cleric-final-wire-before.log`,
`/tmp/eidolon-cleric-final-wire-after.log`,
`/tmp/eidolon-cleric-final-full-server.log`,
`/tmp/eidolon-cleric-final-full-client-after.log`.
Phone captures: `/tmp/eidolon-cleric-final-area-captures-SQHrSI`.

## Still required

Review and repair the separate legacy offline Healing Light and Radiant Strike
calculations, including ordinary combo sequencing, rune/relationship behavior
and healing/damage amounts; they are not covered by the online implementation
claim. Add real remote-observer cast evidence in addition to the current actual
local WebSocket route and private-rank-free rendering unit coverage. Preserve
existing online server ownership while doing so. Package the next version and
patch notes only after the intended release scope is verified.

Screenshot review also finds the oversized duplicate `COMBO: MASS REVIVAL!`
floating text crossing the phone encounter, despite the compact bottom combo
notification. Its source is the legacy `combo` network handler, separate from
the bounded actor-action feedback. Remove that duplication on phones and retain
desktop feedback; do not treat the passing geometry test as visual sign-off.
