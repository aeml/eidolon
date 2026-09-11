# Root/slow integration candidate

Based on accepted primary06ec65fe; runtime candidatea6b37b36 carries only the
root/slow reproduction and repair fromab8252b3/7d648488. It does not carry the
unfinished714bb815 Shield Slam talent-duration runtime/client/copy work.

The diagnostic cherry-pick conflicted because primary lacked the later Shield
Slam duration probe. Kept the new root/slow probe only and retained primary's
existing diagnostics. No passing test was removed or weakened. The promoted
paid root/slow cases remain in the normal server suite as well.

An accidentally started focused check67015 ran before this integration finished;
it is only older-source evidence, not root/slow acceptance. After resolving and
committing,32848 ran the focused race selection againsta6b37b36 and passed8.505s:
root/slow paid casts, overlap/expiry, Seraph follow/lifetime, immunity, stun/impact,
and dungeon movement checks. Log `/tmp/eidolon-root-slow-current-focused-final.log`.

Full server race is still required before advancing primary. Avoid competing
with the active1.0.61 full regression49482. Native four-role full dungeon clear,
saved claims and earned campaign progression remain open; this integration does
not supply them. Existing client/browser evidence applies only to unchanged
client behavior, not to gameplay balance after corrected enemy control expiry.

## Observer boundary coverage

Added actual snapshot/delta->protobuf marshal/unmarshal cases for Enemy and NPC
root+slow start, independent root clear and final slow clear/restored authored
speed.96149 PASSrace1.057s alongside existing stun wire checks, log
`/tmp/eidolon-root-slow-wire.log`. World expiry remains proved by separate paid
casts; these fixtures exercise the resulting serialization boundary, not a real
WebSocket observer or native gameplay.

Added a client status-consumer case applying the same transition order to a
remote actor: both effects attach, root disappears while slow remains, final
slow clear removes its factor/timer and all attached particles.56053 PASS20tests/
1suite1.328s with existing status-effect coverage, log
`/tmp/eidolon-root-slow-client-status.log`. No client runtime changed. This is
render-object lifecycle evidence, not an inspected native screen recording.

The future gameplay release must inherit the1.0.61 domain/Origin/exact-checkout
changes and new live QA endpoints when accepted; never publish this older-base
integration as a replacement that silently restores old domain routing.

## Full current-source acceptance

25686 completed0 on frozena041e6b1. Full server race passes allpackages:
root25.597s, game449.133s, loadtest1.037s, database1.100s, lifecycle1.036s;
remainingpackages no tests. Log `/tmp/eidolon-root-slow-current-full-server.log`.
No racewarning or workerpanic. The source remained unchanged for this run.
This supports advancing primary's root/slow implementation, not closing the
native four-role clear, full talent/copy audit or production release gates.
