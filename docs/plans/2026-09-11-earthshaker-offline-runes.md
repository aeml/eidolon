# Offline Earthshaker rune parity

This follows isolated Fighter Charge8d4256fd, not queued domain1.0.61. Required
native, saved training, remaining Fighter rune/combo and full roadmap gates stay
open. No deployment or complete160-talent audit claim.

## Reproduction and implementation

90592 failed6 tests with5 passing in1.236s. Ordinary offline casts showed missing
Fissure/Aftershock, a three-dimensional range check rejecting valid targets when
the caster was above the ground, and missing base damage/body-edge handling.
`/tmp/eidolon-earthshaker-offline-red.log`.

The new offline handler mirrors the server's6-unit planar circle and Fissure's
forward strip, including target body radii and dungeon wall checks. It excludes
friendly/dead/inactive/remote targets and never simulates gameplay for a remote
or multiplayer source. Damage now includes the existing server base damage plus
twice Strength. Seismic and generic duration training compose at cast time.

Aftershock schedules a managed task at1s with a3.5-unit circle, half the original
base damage and the original cast's trained1s stun. It rechecks current targets,
geometry and immunity, retains a stronger stun, and uses the original cast point
even after movement. It cannot land after death/disposal/scene departure or a
switch to multiplayer. The second wave requests its own smaller effect. Native
visual readability is not proven by mocked presentation calls.

## Evidence

31394 initial focused PASS110tests/4suites2.044s. Added a remote-source authority
check and positive first-wave/pending-task assertions before cancellation tests
so they cannot pass merely because no wave was scheduled.61200 final focused
PASS111tests/4suites1.938s, followed by full lint. Logs:
`/tmp/eidolon-earthshaker-offline-final-focused.log`,
`/tmp/eidolon-earthshaker-offline-lint.log`.

Tests invoke actual Fighter casts and scheduled callbacks with fake timers;
they prove callback timing/order and captured parameters, not real browser frame
timing or elapsed stun expiry. Existing server Aftershock real-delay evidence
remains separately recorded in the Fighter effect-duration document. Remaining
work includes full current-source client/server regression, native render and
combat checks, other Fighter rune/party/combo parity and saved training.
