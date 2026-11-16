# Arcane Shield training — implementation checkpoint

Separate follow-up worktree `/tmp/eidolon-shield-training-CcxkLZ`, branch
`work/shield-training-20260907`, based on local 1.0.43 `e0bc417`. Not packaged or
published at the original checkpoint. Now packaged locally as **Alpha 1.0.44**;
publication remains gated by 1.0.38 and every sequential successor.
Integration `c48a09c` now carries the verified 1.0.38 movement and
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

The prepared browser run reaches a correct 695-point baseline shield, then
fails trying to close details through the covered launcher. The normal panel
has a dedicated Close control; using that visible button completes the route
on **`7f4a157`**, **43.7s**: **695 / 834 / 834** baseline/trained/saved capacity,
actual 20-second expiry and ordinary hostile absorption of **310** points,
leaving **524** and full player health. Scan has zero sanitizations and exact
disposable cleanup finishes. Log: `/tmp/eidolon-shield-training-browser-close.log`.
The full integrated server race suite also passes (root **13.355s**, game
**321.115s**). All prior local handles are closed. The historical talent-consumer
overlay passes **1.523s**; it covers selected promoted consumers, not all 160
talents. Log: `/tmp/eidolon-shield-training-remaining-consumers.log`.

Inspected phone captures prove readable shield details, but reveal two open
visual tasks: the one-effect status sheet wastes most of its large height, and
entrance scenery obscures the actor during hostile absorption. Do not label
those captures full visual polish. Final package adds a closed-panel model
capture, distinct 1.0.44 notes, synchronized login/runtime/deployment version
defaults and the real Shield route in the full predeployment gate. Final
versioned checks are recorded below.

## Packaged 1.0.44 verification

Package `fedf247` passes **214 suites / 3,171 client tests / 104.897s**, lint,
and backend-root race **12.413s**. Gameplay-server source is unchanged from the
integrated full game race pass above. Logs:
`/tmp/eidolon-release44-full-client.log`, `/tmp/eidolon-release44-lint.log`,
`/tmp/eidolon-release44-root-server.log`.

The anonymous sweep finishes **61 pass / 1 fail / 6.0m**. Its phone-HUD case
fails before UI setup when Chrome interrupts **97 module requests** with
`ERR_NETWORK_CHANGED` at 16:16:32 UTC. The underlying network change is not
established. The trace is preserved outside overwritten test output at
`/tmp/eidolon-release44-hud-network-change.zip`; suite log:
`/tmp/eidolon-release44-anonymous.log`. Runtime is unchanged: the test now uses
the existing bounded `openGame` readiness/recovery path before importing UI
components instead of treating network-idle as successful module loading.
Both HUD cases then pass **18.5s** on `56438d7`, retaining their interaction
assertions. This is 61 full-sweep passes plus focused corrected coverage, not
a claim that a fresh complete 62-test command passed.

The final versioned actual Shield route passes **43.9s** on `56438d7`:
**695 / 834 / 834** capacities, actual expiry, **310** absorbed, **524** left,
and successful zero-sanitization scan/disposable cleanup. The closed-panel
portrait capture shows the actual sapphire ward around the Wizard; it is not
an unoccluded-combat or physical-device sign-off. Logs:
`/tmp/eidolon-release44-hud-after.log`,
`/tmp/eidolon-release44-shield-final.log`.

All local package handles are terminal. Preserve the sequential release queue;
1.0.44 is not published, and its own full CI/live gate remains mandatory after
38–43 each completes. Remaining visual and rune limitations above stay open.
