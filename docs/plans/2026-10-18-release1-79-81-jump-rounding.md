# Alpha 1.79.81 jump endpoint correction

The first publication pipeline, CI39115352737 at27d7a1fbd, failed the
terrain-relative jump landing test. The client job passed; deployment has not
been accepted. The same existing test fails locally against unchanged source.

Subdivided simulation updates can accumulate a few floating-point bits below
the accepted flight duration. For example, eight updates of1.1/8 produce
1.0999999999999999. The actor then remains JUMPING until another update even
though the requested simulation budget has elapsed.

The correction canonicalizes only an elapsed-time residue within1e-12seconds of
the accepted endpoint, below the live monotonic clock's nanosecond resolution.
The1.1second flight cap, distance and height rules, authoritative destination,
and existing1500ms native acceptance deadline remain unchanged.

A new regression exercises three distances over3,8,16,60and120updates, plus
three controls that must remain airborne one microsecond before landing.
Five subdivided-clock cases fail on unchanged runtime; all early-landing
controls already pass. After the correction, the focused race-enabled
WorldGrounding/NetworkJump/RealtimeJump/TownRoof/Roof selection passes14top-level
tests and43subcases in3.645s, with no failures or retries. Private negative and
positive logs remain in the owned correction tree's `.qa-jump-rounding`.

This is focused correction evidence. A fresh full pipeline and verified
deployment remain required; prior native/API qualification is not a rerun of
this corrected runtime. Alpha1.79.80 remains the last accepted live release.

## Browser clock alignment

The same initial pipeline also failed hosted browser shard1/3. Its copied-engine
clock test retained a1300ms minimum from the former flight cap. Both attempts
finished earlier (1220.2and1114.4ms) after the intentional1100ms cap change;
the source-module case retained the same obsolete minimum. These are distinct
from the server arithmetic failure. Client812suites/12,595tests and browser
shards2/3and3/3passed; native/deployment/live jobs were skipped.

The shared observer now records the accepted duration and actual WebGL renderer.
Both source and copied-engine cases require exactly1100ms accepted travel,
elapsed time no shorter than that duration, the unchanged1550ms maximum, and
exact logical/rendered endpoints at both15and60FPS. Explicit native runs also
reject software renderers. This changes no gameplay, rendering or upper deadline.

The first local check used SwiftShader restricted to one CPU and missed the
existing maximum at1705.9ms; that failure remains retained. A changed graphics
condition using native AMD/RADV rendering passes both cases in16.8s with zero
retries: source1155.1/1122.6ms and copied1159.3/1128.6ms, all accepted durations
1100ms and all endpoint errors zero. This fixture drives manual RAF cadence
without a server or populated world; it is scoped clock/rendering evidence.
The complete corrected-source CI and deployment remain required.
