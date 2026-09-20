# West-side stash approach correction

## Revised correction — clear the complete town, not a partial scene

The three-case native check onb0236b9e failed: desktop and portrait still stopped
outside storage range, and landscape could not expose the target at its approach
position. Reports/log are retained under
`/tmp/eidolon-stash-approach-20260920-r2-WCMu7v/`, native87856 exit1. No publication
of1.9.25 occurred. All owned services are gone.

The initial collision test omitted the blacksmith at(-30,200). Its actual
generated footprint contains both the stash centre(-28,193) and the proposed
front(-28,196), explaining the connected blocker atX-21.262. The approach-only
helper is discarded; ordinary interaction/chase behavior is restored.

The chest now sits at(-16,193), in the clear gap beside the Trading House and
east of the blacksmith, still west of the casino door. Server spawn, local
fallback/recovery, map markers and administrator obstruction expectations agree.
The server's generated service-collider templates already use live entity
transforms, so no geometry snapshot rewrite is necessary for this translation.

The regression now runs the actual town `loadBuildings` builder, including the
blacksmith, vendor, casino facade and camps, plus the server-owned Trading House
and coffer. It proves the former centre/front blocked, an enclosing2.2m coffer
circle clear at the new location, and full-size walking paths from town/phone
approaches into the unchanged5m interaction range.307 focused collision, map,
stash-driver and version/history tests pass2.597s. The native follow-up is still
required; no connected pass is claimed from the unit model.

## Initial approach-only attempt — superseded by the full-scene result

Local correction for the next release; live1.9.24 delivery remains accepted,
but this connected failure reopens the stash approach path.

Water continuation `earnedwaterregion0920b` ended exit1 after48.8s, before combat:
`#stash-screen` stayed hidden. The retained screen says “Stash • Move closer”.
Independent archive restore confirms the player stopped at
(-21.25407219637283,193.09997818974443),6.747m from the coffer at(-28,193), beyond
its existing5m interaction range. Level61/21946XP/51012Gold and25/70 Golem credit
are unchanged. Owned services and the isolated archive-inspection copy are gone.

The normal initial click and per-frame chase both targeted the chest centre,
cutting across the rotated Trading House. The QA driver also aimed at that
centre and exhausted16 short strides without asserting arrival. This is not a
reason to remove building collision, enlarge interaction range or relocate the
stash back in front of the casino door.

Both game approach paths now share the coffer's exposed front point: three
units along its local positiveZ face, with facing and player height preserved.
Other targets retain their centre approach. Canonical collision sampling from
town spawn proves the direct centre path intersects, while the new path clears
the actual house, coffer, casino facade and a full-size nearby quest NPC. The
earned driver uses the same exposed face, waits substantial ordinary strides
and asserts arrival before clicking instead of silently exhausting its budget.

90 focused collision, stash readiness, combat callout and attack-range tests
pass1.907s; changed-file lint, shell syntax and whitespace checks pass. Initial
fixture-only failure was its missing hostility predicate, corrected in the
fixture without changing gameplay. A bounded native desktop/portrait/landscape
check is prepared: one actual click/tap from outside interaction range, normal
automatic approach, visible storage, close, no grants or direct UI toggles.
This connected check has not passed yet. Phone joystick travel only brings the
west-side chest on screen; it is not counted as a physical-phone user result.

The initial short-check launcher stopped before gameplay: first its runtime
preparation guard caught a missing manifest while preparation was still running;
after preparation completed, Playwright rejected trace/video/screenshot options
inside a describe group. Both logs are retained under
`/tmp/eidolon-stash-approach-20260920-IvwZcn/`; owned services are gone. Recording
options are now file-level and three-case discovery passes. No gameplay result
or repeated Water hunt is claimed from those setup failures.

Alpha1.9.25 is locally packaged with additive stash/admin-history patch notes
and synchronized login, package/lock, README, manifest, server/container/deploy
and CI identities. The release also includes the local bounded administration
rejection/outage follow-ups. Publication waits for the corrected short native
check. Live remains verified1.9.24; full1.10 integration is still open.
