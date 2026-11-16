# Moving-cast profiling after boot recovery

Native System Chrome run `frame09121130`, frozen commit
`9b089ee8b522002d647ffb0b65de8f6f6d48fe33`, passed both Wizard full ability/rune
matrices using the same disposable saved character, `--repeat-each=2 --retries=0`.
Runs took 1.5 and 1.8 minutes, 3.3 minutes total. The backend was real and
isolated on loopback; ANGLE Vulkan used AMD RADV RENOIR. No assertion thresholds,
sample length, initial-cast timing or retry budgets were relaxed.

The two 650ms moving Fireball samples retained 17 and 29 frames (the existing
gate requires more than 10). Their measured per-sample-frame wall times were:

| Measurement | First saved session | Reused character |
|---|---:|---:|
| Mean accumulated update time | 10.62ms | 4.13ms |
| Maximum accumulated update time | 28.60ms | 12.40ms |
| Mean render time | 28.91ms | 17.30ms |
| Maximum render time | 46.90ms | 24.90ms |
| Mean callback lag | 53.63ms | 30.74ms |
| Maximum draw calls | 2,677 | 2,633 |

These are wall times, including possible preemption/driver blocking, not GPU
execution timings. Multiple update calls may occur between samples. Passing
these two runs does not explain the earlier 8-frame failure, establish stable
frame pacing across machines, or close the full four-class live release gate.
The large draw count warrants further scene-level profiling before attributing
the cost to a particular model or changing visual quality.

The profiler restores original update/render method ownership and descriptors
after each sample, including failures. It is test-side instrumentation only.
Six focused suites/66 tests passed in 3.644 seconds; asset preparation, lint
and diff checks passed. Logs use
`/tmp/eidolon-recovered-boot-profile-{preflight,assets,lint}-20260912.log`.

Native log: `/tmp/eidolon-recovered-boot-frame-native-20260912.log`.
Full report, test results and log archived at
`/tmp/eidolon-recovered-frame-pass-w5iSSo`; the report's embedded ZIP contains
both `moving-base-cast-evidence` JSON attachment bodies. Wrapper credential
scan passed with zero files requiring sanitization. Disposable services and
ports 18185/18186/41875 were cleared before the next party run. No deployment
or version bump is implied by this evidence.
