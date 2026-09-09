# Fresh pointer evidence in moving dungeon scenes

2466 complete recovery run on c5e3204 failed its first seven-test dungeon batch:
two entrance clicks selected InfernoTitan, and a Verdant retreat produced no
movement with BriarMatron pending. Four other cases passed5.8m. Original log,
HTML and test-results retained at `/tmp/eidolon-rest58-verdant-r12-failure-P1ap9x`.
Wrapper sanitized2files; exact r12containers/image/network/ports absent afterward.
No later all-route tests ran; no full-pass claim.

Portal click evidence shows InfernoTitan first in the fresh hit stack, selected
and pending, with no portal request. The game correctly did not open the covered
entrance. A previously clear hover cannot guarantee an unchanged click target.
The original Verdant retreat lacks click-time evidence; its cause remains open.

8b9073b adds a read-only click observer/classifier shared by these QA flows:
only a successful desktop canvas click with the same active hostile ID first in
the fresh hit stack, selected, and pending qualifies as interception. Missing,
mixed, dead/nonhostile, mismatched, ignored or keyboard-input evidence does not.
The observer records outcomes; it does not force targets, move actors or send
game requests. Each ground attempt clears the previous record before input.

An intercepted portal click must issue zero portal requests and reacquires an
exposed point inside the existing three-attempt bound. Exhaustion still throws;
the real menu, enabled entry and authoritative instance transition remain required.
If every attempted ground click instead targeted a hostile, a distinct error
lets combat continue without counting a retreat or changing death/deadline bounds.
No-input and actual failed movement remain separate; one unproven/failed movement
attempt prevents this classification. Production input/priority remains unchanged.

68828 focusedPASS30tests/.686s+lint.99520 expandedPASS39tests/.736s+lint includes
missing/mixed evidence and both earned/prepared combat callers.34455 fullclient
PASS252suites/3564tests/87.123s+lint on8b9073b, Node24.18.0. Logs:
`/tmp/eidolon-rest58-pointer-evidence-{focused,expanded,lint,expanded-lint}.log`
and `/tmp/eidolon-rest58-pointer-full-{client,lint}.log`.

The optional dungeon-inputs route replays the exact original seven-test batch
without modifying all. Actual replay and a subsequent complete all-route pass
are required before58 publication. The original failures stay failed; this QA
change is not a claimed movement-runtime fix or sustained performance acceptance.
