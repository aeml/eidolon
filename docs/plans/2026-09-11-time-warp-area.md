# Time Warp trained area — unreleased candidate

## Player-facing correction

Time Warp now consumes Volatile Insight and Mana Geometry in its party-buff
radius: base 15 units, rank-five Volatile Insight 17.25, rank-five Mana Geometry
16.5, and both together 18.75. The server uses the trained value for its spatial
query and final body-padded check. Its accepted event carries the same radius,
full-circle arc and caster-centered origin. Owner prediction and rank-private
remote presentation use that boundary in high and low graphics modes.

Offline reach now uses the same horizontal, body-padded circle rather than a
three-dimensional center-only distance, and no longer emits an extra untrained
ring over the canonical presentation. This is a reach/presentation correction,
not a redesign of saved talents or Time Warp's underlying support policy.

## Evidence and limits

- Shared JSON cases drive paid server and offline casts at the inside/outside
  boundaries. Server cases include ordinary and scale-four bodies, same-deadline
  recipients and a spatial-cell boundary away from world origin.
- Initial actual-cast server probe failed all 16 subcases: trained recipients
  were missed, and the accepted event lacked resolved shape/caster origin.
  Client probe failed 15 of 16 cases on old reach, radius and presentation.
- Corrected focused client set: 5 suites / 72 tests, 4.232 seconds; full lint
  passed. Includes Guardian Roar, Wizard routing and Arcane Shield regressions.
- Additional paid server cases retain friendly support through walls, NPC
  support, the zone-wide set bonus, and exclusion of dead, hostile and
  other-instance recipients. Broader focused race run passed, game package
  15.827 seconds (`TestTimeWarp|TestTalentDuration|TestPartySupportAbilities|`
  `TestPlayerBasicAttackCadence|TestRecipient` prefix filter). Session 52853 is
  terminal exit zero. This is focused coverage, not the full Go suite.

Logs: `/tmp/eidolon-time-warp-area-{client-red,client-green,client-focused,server-red,server-green,server-focused,lint}.log`.

Full client/server regression and a native trained Time Warp boundary test still
remain. No concurrent browser check is launched while the four-player dungeon
route owns the GPU. This candidate is not deployed; Alpha 1.0.62 is unchanged.

Known follow-up found during inspection: offline Time Warp still overrides the
canonical 60-second cooldown with 90 seconds, uses a fixed 10-second timer
instead of the server's trained 8-second base, and needs full recipient-stat /
expiry, set, relationship and authority parity. Its Mastery also requires the
remaining per-skill consumer audit. These are not proven fixed by area tests;
the full 160-talent and 1.1 support/build acceptance gates stay open.
