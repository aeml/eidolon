# Moving-cast frame diagnostics

The stale-hover native candidate8bcb302a failed its first Wizard pass on eight
frames in the existing650ms moving-Fireball window; its second full matrix
passed. That is not sufficient animation/performance acceptance. Host load was
observed above60 on16 logical CPUs, but that alone does not establish causality.

The short moving-cast sampler now measures ordinary GameEngine update/render
calls during that same window. Each retained frame includes call counts,
measured wall time, draw calls, triangles, callback delay, and the existing
movement/ability data. These timings include scheduler preemption and driver
blocking; they are not GPU execution measurements and cannot alone distinguish
all sources of a long render call. Small measured update/render totals with
large inter-frame gaps would support investigating work outside those methods;
large totals identify where more detailed profiling belongs.

The helper is self-contained for page.evaluate serialization. It preserves
method receiver, arguments, return value and thrown errors, and restores the
original own-property descriptors (or inherited method lookup) on completion
and sampling failure. It does not modify gameplay, the650ms RAF deadline, the
strict >10-frame assertion, movement thresholds, retry counts or test route.
It adds no permanent runtime instrumentation or warm-up casts.

## Validation

Initial authored contract RED was a missing helper module. Four focused
suites46testsPASS3.672s verify timing accumulation, unchanged returns/throws,
deadline, per-frame counter reset, restoration and existing rune/input routes.
Full lint, assets and whitespace checks pass. Logs:
`/tmp/eidolon-moving-cast-profile-{red,green,lint,assets}-20260912.log`.

Parent61fd4b96 is the combined1.1 candidate: the saved-rune preparation and
stale-hover fix forward-ported onto f016e0f7. Its one merge conflict retained
both rune-repeat coverage and the Teleport/Phase test, adapting the latter's
expected command to the existing named stage wrappers. That integration's
seven focused suites98testsPASS5.773s, lint and shell syntax pass; hosted
CI34689363204 is pending. No primary/integrated fast-forward or deployment yet.

Native execution of this diagnostic is pending behind the active four-role
party test. No new frame performance or causal conclusion is claimed.
