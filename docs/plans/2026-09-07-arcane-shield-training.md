# Arcane Shield training — implementation checkpoint

Separate follow-up worktree `/tmp/eidolon-shield-training-CcxkLZ`, branch
`work/shield-training-20260907`, based on local 1.0.43 `e0bc417`. Not packaged or
published; the new 1.0.38 movement correction has not yet been carried here.

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

Remaining: full client/server race and lint; actual baseline/trained/saved-login
shield casts, rendered absorption/expiry inspection, release packaging/notes,
and sequential CI/live verification. Offline Reflective/Explosive rune behavior
still needs separate parity work; only their server consumers are verified here.
This does not close the four-class talent audit or the full roadmap.
