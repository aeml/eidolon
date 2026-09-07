# Arcane Shield training — implementation checkpoint

Separate follow-up worktree `/tmp/eidolon-shield-training-CcxkLZ`, branch
`work/shield-training-20260907`, based on local 1.0.43 `e0bc417`. Not packaged or
published. Integration `c48a09c` now carries the verified 1.0.38 movement and
shared-combat race corrections through the sequential 39–43 release queue.

Nine shared baseline/rank/rune/focus/duration fixtures exercise actual paid
server casts and a real incoming melee-impact consumer. Six cases fail before
repair (**0.358s**): rank 1/5 leave absorption at 150 instead of 156/180 and
health after a 200-damage hit at 950 instead of 956/980. The raw-rank-99 case
also verifies normalization without rewriting stored ranks. Existing duration
composition and expiry checks remain intact.

Arcane Shield Mastery now grants a distinct **4% absorption per rank**, not a
damage multiplier that can be inflated by Spell Focus. Casts use a normalized
training snapshot, with capacity fixed until depletion or expiry. Updated copy
names damage absorption. Actual server Reflective/Explosive impacts return
**54 / 180** from a trained 180-point shield, even after ranks are removed from
the test owner. Focused race checks pass **3.878s**, then expanded rune/expiry
checks **3.473s**. Logs: `/tmp/eidolon-shield-training-before.log`,
`/tmp/eidolon-shield-training-server-after.log`,
`/tmp/eidolon-shield-training-runes.log`.

Offline casts use the same shared capacity/duration cases and canonical paid
cooldown. They preserve Spell Focus, clear depleted/expired shield state and
do not create a second shield on remote/multiplayer replicas. Thirteen original
checks reproduce **11 failures / 2 passes / 1.330s**; an additional locked-cast
check reproduces spending mana before the subclass unlock guard. The unlock
check now precedes payment. Focused existing Wizard checks pass **25 / 1.508s**
before the final locked-cast guard; status/attached-effect checks are rerun after
it. Logs: `/tmp/eidolon-shield-training-client-before.log`,
`/tmp/eidolon-shield-training-client-focused.log`,
`/tmp/eidolon-shield-training-status-final.log`.

Checkpoint **`304f2a6`** passes **213 client suites / 3,161 tests / 121.867s**,
the full Go race suite (**root 26.487s, game 278.437s**) and final lint.
The final shield/status/attached-effect set passes **62 / 1.668s** after the
locked-cast guard. All these handles are terminal success; logs:
`/tmp/eidolon-shield-training-full-client.log`,
`/tmp/eidolon-shield-training-full-server.log`,
`/tmp/eidolon-shield-training-final-lint.log`.

Remaining: actual baseline/trained/saved-login
shield casts, rendered absorption/expiry inspection, release packaging/notes,
and sequential CI/live verification. Offline Reflective/Explosive rune behavior
still needs separate parity work; only their server consumers are verified here.
This does not close the four-class talent audit or the full roadmap.

Browser checkpoint `1ff8697` introduces a separate disposable `shield-training`
route, including a fresh allowlisted retry account. It buys mastery through the
phone talent menu, observes server-owned capacities before/after training and
fresh login, checks attached effects and real-time expiry, then approaches an
ordinary hostile and removes existing waypoint protection to observe absorption.
It never injects shield state, ranks or damage. This new route is still under
verification, not yet part of the full release gate or a passing browser claim.
Integration checks pass **242 client tests / 2.327s** and repeated concurrent
damage/Whirlwind/Shield checks **8.123s**. The first browser run fails before
login (**3.0m**): the new worktree lacked generated `vendor/` dependencies,
confirmed by missing files and HTTP 404. Credential scanning and disposable
cleanup finish. After that handle closes, `npm run prepare:client` prepares
the local ignored runtime files. The new route also uses its phone composer
for the waypoint, not the desktop helper's collapsed chat tabs. A rerun is
required; the failed setup proves no Shield behavior. Full integrated server
race is still running at this checkpoint; logs:
`/tmp/eidolon-shield-training-integrated-client.log`,
`/tmp/eidolon-shield-training-integrated-server.log`,
`/tmp/eidolon-shield-training-integrated-full-server.log`,
`/tmp/eidolon-shield-training-browser.log`.
