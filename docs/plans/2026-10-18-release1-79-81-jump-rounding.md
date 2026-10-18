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
