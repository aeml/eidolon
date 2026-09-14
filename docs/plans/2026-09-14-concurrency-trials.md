# Bounded concurrency trials — current 1.9.8 candidate

September 14, 2026. Exact compiled server source/release
`08f020bcba55a187f83bc8ddf5a20980fde88b15`, Alpha1.9.8. These are actual admitted
WebSocket clients against an isolated server, not simulated counters. Targets
were recorded in the [final integration audit](2026-09-14-final-integration-audit.md)
before execution. No production account, wager, currency or game data was used.

## Environment and limits

Ryzen7 5700G,8cores/16threads,31,456MiB RAM, shared Linux host; Mongo7.0.16 bound
only to127.0.0.1:38761 and API127.0.0.1:38762. Production and unrelated services
remained running. No owned native Chrome gate ran during these trials;1.9.8 CI
was on GitHub-hosted server/client checks. This is not dedicated-host capacity,
Internet/Cloudflare/TLS latency, browser FPS, full raid combat or a long soak.

Existing loadtester mixed combat/town/social scripts used ordinary registration
and join, random in-memory credentials and no privileged grants. Actions are
scripted requests, not proof of accepted abilities, completed fights or quests.
Admissions count the first authoritative own Player snapshot, not sent requests.
No new load framework was added. Health sampling for50/100clients was every5s.

Targets: all requested players admitted; zero read/write/decode errors; database
ready; aggregate state frames at least5per configured client-second; heap below
512MiB and four times the healthy pre-load baseline. The initial API heap was
80,229,568bytes. No target was increased after observing results.

## Results

| Requested players | Configured duration | Admitted | State frames | Transport/decode errors | Sampled heap | Outcome |
| --- | --- | --- | --- | --- | --- | --- |
| 10 | 30s | 10 | 9,033 | 0/0/0 | Before80,229,568; after65,864,232bytes | Baseline passed; heap observations are before/after only |
| 50 | 120s | 50 | 103,053 | 0/0/0 |26samples, maximum164,028,432bytes | Passed bounded admission/replication/memory criteria |
| 100 | 120s planned; stopped early | 100 | 68,055 | 0/0/0 | Maximum380,255,080bytes | **Failed memory budget; not a completed100-player acceptance** |

All sampled health responses reported database ready. At100clients the peak
exceeded both four times the original healthy heap(320,918,272bytes) and four
times that stage's first healthy sample(91,344,448×4=365,377,792bytes).
The100-client process was stopped with SIGINT when the exceeded budget was
observed, at03:26:23UTC. Its zero command exit does not turn this external
memory-budget failure into a pass, nor prove the full120seconds completed.

After disconnect, final sampled heap returned to75,997,472bytes; a later health
read was78,686,096bytes and40goroutines. This supports transient allocation
pressure, not a demonstrated retained-memory leak. Do not weaken the limit,
increase GC tuning blindly or rerun the same load without a specific change.

Logs/health samples: `/tmp/eidolon-final-load-20260914-cIztvJ/`, files
`ten-clients.log`, `fifty-clients.log`, `fifty-health.jsonl`,
`hundred-clients.log`, `hundred-health.jsonl`. Logs use bot indices rather than
credentials. All clients ended; API session96218 terminated, Mongo container
`eidolon-final-load-mongo-20260914` removed, both loopback listeners absent.
The temporary server journal directory is retained locally, not uploaded.

## Allocation follow-up — evidence, not yet a fix

The existing `BenchmarkGetStateForPlayer` workload (250 nearby enemies plus the
normal world) measured **999,884ns/op,1,643,452bytes/op,556allocations/op**.
One-second benchmark run completed2.507s. Allocation profile attributes92.27%
of allocated bytes to `World.copyEntity`; this is a benchmark allocation profile,
not a live heap profile or proof of a leak. Files:

- `/tmp/eidolon-state-benchmark-20260914.log`
- `/tmp/eidolon-state-allocations-20260914.pprof`
- `/tmp/eidolon-state-benchmark-20260914.test`

Current `broadcastState` independently calls `GetStateForPlayer` for each client;
each observer allocates full detached Entity structs for nearby actors, even when
many observers see the same actors. That is a concrete optimization candidate.
Inspect serialization mutation, owner-only fields and instance-transition
semantics before sharing any immutable per-broadcast snapshots. Do not introduce
a stale cross-tick cache, expose private EP/inventory, drop effects/animation
fields or weaken instance isolation just to pass a memory target.

Next: reduce this demonstrated snapshot allocation cost, verify relevant
replication/privacy/transition/race checks and the same benchmark, then repeat
only the affected bounded load stages. Broader campaign/group-raid/device scope
and exact1.9.8 deployment remain open; no whole1.10 completion claim.
