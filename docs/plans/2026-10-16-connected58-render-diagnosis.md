# Current accepted-source connected renderer diagnosis

Source: `4f5b2e57fbe2112cea68e0da10fc288ad5c85b47` (accepted Alpha1.79.58).
The earlier [54diagnosis](2026-10-15-connected54-render-diagnosis.json) used
`5bccd9414ed7028178554400a87c82b87f041d36`, before the selected constructor-owned
foliage draws. Repeating that old leaf-transform/light-cache proposal would use
stale evidence. Existing leaves already freeze their local transforms. No new
renderer experiment or runtime change is selected by this diagnosis.

Two bounded disposable Go-race fixtures ran once each, before59native/live CI,
with all four saved classes and fourteen real equipment slots, one native RADV
renderer and three normal authenticated socket peers. Each ordinary sample
retains60warmup/180visible frames, exact reported-decimal intervals and restored
instrumentation. Separate180-frame phase clocks and three-second CPU samples are
diagnostic only. Each fixture passes once/one alternative four-browser case is
skipped, with zero retries/flakes/race/panic markers and preserved saves/peer
liveness. Temporary server processes, Docker databases and ports18218/18219/4190
were confirmed stopped. No production accounts/database were used.

| Profile | Maximum calls / limit | Maximum triangles / limit | Frame median / limit | Frame p95 / limit |
| --- | --- | --- | --- | --- |
| High | 246 / 350 | 180755 / 250000 | 16.7 / 20ms | 33.4 / 33.4ms |
| Low | 153 / 200 | 79641 / 85000 | 16.7 / 33.4ms | 16.7 / 50ms |

Both samples meet their unchanged original limits. High ordinary CPU-loop
median/p95 is19.7/29ms; Low11/14ms. High starts with47geometry jobs pending and
ends at0, with28→65installed; Low is already settled at71installed throughout.
The prepared-state difference is retained. These are fresh independent samples,
not paired speedup evidence and not evidence clearing previous cold failures.

The separate diagnostic clocks still place most CPU work in world rendering:
High13.8ms median/16.3ms p95, Low11.3/15.3ms. Top native function samples include
scene traversal, matrix work, shader parameters and shadow submission. Current
foliage counters record51,330visits/145frames High and64,380/185Low, with zero
view/shadow revisions during each separate CPU sample. These counters replace
stale planning assumptions; they do not justify unsafe descendant caches or
revive rejected actor-light membership/static batching experiments.

Scope: both viewports are1280×844 on this native host. The existing private
fixture explicitly uses`earth-elevation-rocks-v1`; public production remains
`flat-v1`. It is standing/movement with normal generated-world populations,
not trusted peer input, a representative battle, physical-phone review or
whole-world certification. High/Low screenshots were inspected for scene/party
sanity, not accepted as final world art. Original historical cold/forest/combat/
party/device counterexamples remain open. A representative production-flat
moving/combat route is the next distinct performance question; these two samples
must not be replayed simply to obtain more favorable timing. Soak/stress remains
deferred until features are nearly complete.

Retained preflight: the new owned tree initially lacked the ignored generated
worker; the harness stopped in0.002seconds before any server/browser/sample.
That failure and the inapplicable sanitizer failure remain retained. Restoring
the exact pinned worker SHA-256
`28b738eaf5aa3a9ba5df513fbd8c400f3d82a5f0f2624d529731c57b80a95f03`
allowed the actual High run. This is a preflight correction, not a timing retry.

Evidence root:
`/home/aeml/.local/share/eidolon-connected58-profile-20261016/.qa-connected58`.
Sanitization scans9plaintext files/two embedded report records per fixture and
finds zero remaining prepared account strings. Raw screenshots contain only
synthetic fixture identities and remain private QA evidence.

| Evidence | Bytes | SHA-256 |
| --- | ---: | --- |
| `high/terminal.json` | 958 | `4fccfca949766dece7627eead8aa02fd9caf06dfe9a2917a3e8edfec1e3511fe` |
| `high/sanitized.json` | 429 | `7258b18c58b4d57078569d11a7182d4426f751a805cb7fc6d96f3f8e3c25d573` |
| `high/budget-summary.json` | 2143 | `fb8fe2d2d7ee9cad503b03820c267198c0e99ddf0065ea9bb3c4965138c7a3f4` |
| `high/single-renderer-live-party-profile.json` | 79999 | `21b87038e2b7f82d8ffe4299ee1df5026e302b19a3d9d9c2c67528a28b278ada` |
| `high/diagnostic-party-phases.json` | 193058 | `6b91906e96a675f1d6aa1efde9044a75a3d865eed570898349ba1f45f7e9337f` |
| `high/diagnostic-cpu-functions.json` | 31672 | `25fb828434d7c46d93dfa79547586bd47dad8379504c2b66e61ddb12f00855fb` |
| `high/native-report.json` | 737886 | `73baaf423a0cad840389cf2cbd342d11e2ba8ab16975b864b01b3ef4e0598f59` |
| `high/server-sanitized.log` | 4187 | `262a10902b30a44d54e320a3e5e6c1bfa6fc12a7fdfce9dd6ae97b7f35c61bf3` |
| `low/terminal.json` | 956 | `c36f565e00961e41959361db401cca431f429754d870d3d0b7fd1937b9d30549` |
| `low/sanitized.json` | 429 | `7258b18c58b4d57078569d11a7182d4426f751a805cb7fc6d96f3f8e3c25d573` |
| `low/budget-summary.json` | 2084 | `d66f6664cf6bae976526d74946ecbef1b04be8eedbde0d3478fc0a21f5587caa` |
| `low/single-renderer-live-party-profile.json` | 79704 | `965f568cd271c7ea88638b5cd6b7eebac137609a77d1595b300f462bd47d0985` |
| `low/diagnostic-party-phases.json` | 188137 | `d2609594d11f43261a75270f772d4d29c39a8428a45fc06b2c583e3198bfeddc` |
| `low/diagnostic-cpu-functions.json` | 29656 | `a82d74582c1c0881dfbbe8059ca9ecbae523c185504397ad1f03e26f85e7b85e` |
| `low/native-report.json` | 727233 | `63df765c25fb29530becc3ab8fac0767d9c1c1342fb9789d81f5cbe9418fb8b1` |
| `low/server-sanitized.log` | 4187 | `4a96be8cd59dd19aeebad24b58551fbb96ebe43f883fc8c8194993266961537e` |
