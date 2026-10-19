# Casino socket reader correction

Prepared Alpha 1.79.84 source `dfd41fddbab91d506c8ec5613d3186d6a7679461` entered
[CI 39211925284](https://github.com/aeml/eidolon/actions/runs/39211925284).
All 823 client suites / 12,807 checks passed. All three browser shards passed
517 cases, with 14 existing exclusions and no reported failures or flakes.
The server job failed the real EP baccarat case with a connection reset while
seating guests after the VIP walk; its Gold roulette case passed. The five
remaining native/input/deployment/live jobs were skipped. The original run was
neither cancelled nor retried, and its failure evidence is retained. This source
was not deployed; Alpha 1.79.83 remained the accepted baseline at that checkpoint.

The VIP approach wrote moves for both guests without reading either socket
during its two legs. The catalog route includes 41.3 seconds of explicit sleeps,
besides setup and processing. Gorilla handles incoming WebSocket pings only
while the client reads. That fixture differs from an ordinary browser, which
continuously consumes control/state frames. Lack of reading can leave pings
unanswered and state queued. The original hosted reset alone does not identify
which close reason fired: its runner's private server log was not included in
the coverage artifact.

A short loopback protocol probe emits stale state, a ping, and then the expected
movement acknowledgement. It requires the actual VIP approach to consume state
and answer the ping. With the old unread behavior, the race-enabled probe failed
its ping assertion in 1.36 seconds. After adding reads, the unchanged probe passed
in 0.36 seconds. Both raw reports and the pre-correction source hashes remain in
the owned worktree's `.qa-casino-experience/` evidence. This checks protocol
continuity, without traffic volume or a long idle wait.

The corrected fixture consumes each guest's own acknowledged movement sequence
before advancing. Guard interaction, floor context, 350 ms steps, ordinary
movement/seat restrictions, wagers, duplicate suppression, departure settlement,
recent history, and fresh-process wallet recovery remain unchanged. Existing
10-second ordinary-message, 45-second house-read, 60-second server pong, and
180-second case limits are unchanged. Failure diagnostics expose only aggregate
fixed-name transport counters, without private server logs or tokens.

The corrected disposable database suite passed 11 top-level tests /
23 cases including subcases, with no skips or race reports. The actual
two-guest socket/restart case passed in 137.43 seconds: Gold roulette in
45.71 seconds and EP baccarat in 91.70 seconds. Both test and application
executables were race-enabled, with capped resources and a private network
namespace. The owned fixtures were removed after completion. All five repository workflow status classes were
checked empty before local compilation and socket qualification.

No game runtime, odds, wallet, schema, client, asset, release version, or note
history changes in this correction. Existing source/copy visual qualification
retains its original source labels. A passing actual socket suite and a new
complete source/CI/deployment/public verification are required before Alpha
1.79.84 is accepted. Soak/stress remains deferred; the full game goal stays open.

The corrected source b410683fae3c020c8b3872f0c1cf3cb45cefd8d3 subsequently passed
its original complete CI, both deployments, live checks, and normal-TLS public
identity/artifact verification. [Scoped 84 acceptance](2026-10-19-release1-79-84-acceptance.md)
retains the original failed run and all broader open requirements.
