# Alpha 1.79.79 Jest worker lifetime correction

Corrected source d410/CI39090770088 fails the client job when a reused Jest
worker reaches its4GB V8 heap limit. The job records803passing suites and12,517
passing tests; the remaining ComboNotificationReadability suite crashes before
its four cases run. The native stack and worker memory error are retained. This
is an unaccepted source; no failed result is waived or described as deployment
acceptance.

The correction adds `workerIdleMemoryLimit: '768MB'` to the existing Jest config.
Jest can retire a worker between completed suites after its heap crosses that
limit. It does not raise the heap ceiling or stop a running test. All original
configuration fields, discovery, concurrency policy, assertions, coverage and
coverage thresholds remain structurally identical. Game runtime/assets/server,
versions and the qualified late-bag and wardrobe fixtures stay unchanged.

A controlled local lifecycle observation uses four tiny suites, two workers and
a1MB idle threshold to make process retirement observable without allocating a
large heap. The four suites run in four distinct real processes; interval
observations retain the two-worker concurrency. That probe proves the selected
Jest mechanism, not the complete production workload. With the production768MB
policy and two workers, the original ComboNotificationReadability and
GameEngineInstanceLifetime suites pass all11cases with coverage in37.2seconds.
Both runs use the actual local Node24.18 runtime. Hosted CI uses its own selected
Node24patch and still needs a new exact-source full release run.

Private evidence:
`/home/aeml/.local/share/eidolon-jest-worker-lifetime-20261018/.qa-jest-worker-lifetime`.
Private lifecycle files stay untracked and are not added to the game's permanent
suite or publication. This qualifies the bounded configuration correction only.
Wait for the existing CI to finish and freeze its complete failed packet, then
publish corrected source through fresh build/CI/deployment/live acceptance. Do
not rerun unchanged failed source or weaken the original acceptance gate.

The larger game/readiness goal remains active. This does not qualify the held
1.79.80 assembly, spatial prototype, final art/performance/devices, feature freeze,
beta admission or launch. Soak/stress and human campaign/phone feedback remain
deferred, not passed.
