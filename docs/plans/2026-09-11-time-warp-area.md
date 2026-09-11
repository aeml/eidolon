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
  other-instance recipients. Broader focused race run is recorded separately
  after terminal completion.

Logs: `/tmp/eidolon-time-warp-area-{client-red,client-green,client-focused,server-red,server-green,server-focused,lint}.log`.

Full client/server regression and a native trained Time Warp boundary test still
remain. No concurrent browser check is launched while the four-player dungeon
route owns the GPU. This candidate is not deployed; Alpha 1.0.62 is unchanged.

Follow-up found during initial inspection: offline Time Warp overrides the
canonical 60-second cooldown with 90 seconds, uses a fixed 10-second timer
instead of the server's trained 8-second base, and needs full recipient-stat /
expiry, set, relationship and authority parity. Its Mastery also requires the
remaining per-skill consumer audit. These are not proven fixed by area tests;
the full 160-talent and 1.1 support/build acceptance gates stay open.

## Offline paid-cast parity — September 11 follow-up

The duration/cooldown/recipient defects above now have a local correction.
Twenty-one actual offline tests first produced 17 failures / 4 passes (1.578s).
Locked Time Warp now rejects before payment/presentation; a valid cast retains
Actor's canonical 60-second trained cooldown, committed before receiving the
buff's own CDR. It no longer consumes Spell Focus's next damaging-spell charge.
Shared Wizard duration metadata gives Prismatic Control its existing 4% per rank
on the server's 8-second base, snapshotted once for every recipient.

The support implementation includes the caster even outside the chunk list,
filters hostile/dead/inactive/replica/other-scene targets, includes friendly NPCs,
and retains friendly support through walls. Six actually equipped Temporal Weave
pieces activate zone-wide support; five do not. Recipient recalculation applies
movement speed/CDR immediately. The existing attack-timing factor supplies haste
without double-applying it to attack-speed stats. Expiry clears and recalculates
offline stats even during stun, while remote/server-owned stats are not rebuilt.
Refresh from a second caster does not compound the bonus.

Focused final regression: 7 suites / 127 tests, 2.101 seconds, plus full lint;
session 87980 terminal zero. This includes area/remote presentation, recipient
expiry, shield, Wizard and active-buff-tracker checks. The old prepared area
fixture now calculates real level-30 maxima before setting its 200-mana starting
pool, because applying haste legitimately rebuilds equipment-derived stats.
Server inputs remain unchanged from the accepted focused race run above.

Logs: `/tmp/eidolon-offline-time-warp-{red,green,focused,lint}.log`.
Full regression and native trained area/buff proof remain pending. Prepared set
consumer tests are not earned/saved-set gameplay proof. Time Warp Mastery's
consumer and the wider Wizard timed-effect audit remain open; this entry does
not close the entire skill tree or publish a release.
