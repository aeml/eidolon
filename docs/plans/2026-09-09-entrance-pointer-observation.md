# Fresh entrance-pointer observation

The complete58 isolated route57389 on5a17be1 failed after two authenticated
tests passed. Its third route sampled a hover identifying the Verdant entrance,
but the actual click raycast selected an Inferno Titan. The final assertion was
correct to reject that click. Original log `/tmp/eidolon-rest58-all-node24-0554.log`,
sanitized archive `/tmp/eidolon-rest58-full-portal-failure-U24ntr/test-results`;
wrapper terminal1, exact temporary containers/image independently absent.

Source inspection found that pointer sampling is budgeted at20Hz. After moving
the pointer the old helper immediately tested `hoveredEntity`, which can still
describe the previous coordinates while `needsRaycast` is true. The actual click
always performs a new raycast. This establishes a helper freshness gap, not
proof that every mismatch comes from that gap: a moving actor may also cover a
previously exposed point. Production enemy/interactable priority must not change
to make the test pass.

Extracted the unchanged hover predicate into a read-only helper and reproduced
four failures/two passes in six deterministic cases (91344,0.638s): deferred
sampling, transition to an enemy, eventual entrance readiness, pointer leaving
the canvas, initialization and wrong/missing targets. Initial87437 used bare
Jest without the repository's ESM invocation and failed before discovery; it is
not a behavioral baseline. Use explicit Node24 and `npm test`.

The helper now requires the normal pointer sample to be complete and the pointer
to remain on canvas. It does not force a raycast, move an actor, assign hover,
change target priority or weaken the final click/menu/dungeon assertions. The
existing15s pointer deadline and candidate sampling remain unchanged. A mismatch
also logs the existing public click probe before throwing, preserving evidence
that the previous failure did not capture.

91607 passed239tests/two suites1.273s (new observation and version presentation),
plus lint/diff. That command also named a nonexistent ActorRaycastHitbox test;
do not claim it ran. The separate actual GameEngineRaycastPriority regression is
recorded in `/tmp/eidolon-rest58-entrance-raycast-regression.log`. Full client,
actual portal and complete gameplay checks follow on the new frozen source.
All production gameplay/metadata is unchanged from5a17be1, including the already
verified four-class recovery and native rest behavior. This is not a live claim.
