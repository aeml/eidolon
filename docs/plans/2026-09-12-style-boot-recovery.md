# Recover partial interface stylesheet loading

Live inspection of frozen party run87251 identified the pending operation as
helpers.js:261, the Cleric's registration click. The full JS readiness flag was
true, but24 imported stylesheets had failed with net::ERR_NETWORK_CHANGED.
Their CSSImportRule.styleSheet values were null. Missing start-screen.css left
the Register button inheriting pointer-events:none from the world UI layer;
its center hit HTML instead of the button. The Fighter's loaded page had the
complete import tree and normal styles. This is direct evidence of the party
setup failure, distinct from the independently reproduced login-reply defect.

The exact worker was inspected through a temporary loopback Node inspector:
only step locations, CSSOM/resource metadata and computed layout were returned.
No credentials, input values, tokens or raw protocol payloads were inspected.
The inspector was closed after every read and port9229 verified absent. Safe
evidence: `/tmp/eidolon-party-live-css-diagnostic-20260912.json`; inspection
script `/tmp/eidolon-inspect-party-wait-20260912.mjs` contains a frozen worker PID
and MUST NOT be reused without fresh identity validation.

After establishing this unrecoverable document state, the owned native test was
interrupted through its existing TTY, not restarted on an observation timeout.
It ended130/one interrupted test after27.7m, no dungeon entry or clear. Wrapper
credential scan passed/sanitized0. Artifacts retained at
`/tmp/eidolon-party-css-interruption-7Mn5ar`; owned services/ports cleared. Soak
and unrelated workloads were untouched.

Startup now validates the full stylesheet import tree before wiring gameplay
UI or declaring eidolonReady. Missing imports trigger up to3 replacement loads
with10s waits, preserving the release query identity. Incomplete load events do
not count as success. Exhaustion leaves an accessible, inline-styled recovery
screen outside the pointer-disabled game layer; its Retry button reloads the
page. Successful loading removes the screen and continues ordinary startup.

## Verification

- Actual stylesheet/main/menu suites90PASS3.585s; lint/assets/diff pass.
- Browser partition/runtime versioning5suites44PASS4.557s. The anonymous CI
  list includes both new browser cases; existing cases remain intact.
- **System Chrome98501 PASS**, frozen1e012a06: transient imported-CSS loss
  recovered and real patch-notes controls worked2.5s; permanent loss stayed
  unready, exposed Retry, then recovered through its real click3.3s. Two tests
 7.3s total, one navigation before recovery, no openGame helper retry masking
  the failure. This proves startup recovery, not dungeon combat/frame pacing.
- Logs `/tmp/eidolon-style-boot-{green,lint,assets,enrollment,native}-20260912.log`.

Parent auth308e83ae's hosted failure was gate enrollment, not a runtime auth
regression:46assertions failed because the new stage displaced initial stats
and was absent from the timing fixture. Auth ef4f3ec2 (here cherry-picked as
e4f39ae9) preserves initial-stats/authenticated ordering, adds recovery after
them, and includes its fail-fast/timing contract. Four suites83PASS2.194s;
CI34690510473 is pending. Full style/auth CI and real-server auth interruption
verification remain required before integration/release. Production unchanged.
