# Alpha1.79.82 live-check diagnosis and analytics correction

Source48cf3c079c3e118c6aceaf6e9507ce6bd5f9a293 reached both deployments.
OwnCI39137868646 is terminal failure: nine jobs passed and the final live job
117725885765 failed. No unchanged-source rerun was requested.82is deployed,
not accepted;81remains the last fully accepted milestone.

The anonymous/persistent group recorded7passes/1skip/1flaky. The anonymous
surface retried after a Google Analytics collection request reported
ERR_NETWORK_CHANGED. The following recovery group recorded1pass/1failure;
its natural expiry/reentry assertions completed, then its strict collector
rejected GET`assets/gameplay-geometry/indices.62dceb9abec13cb0.bin`
withERR_ABORTED. The subsequent rested-party group never ran. No skip or
retry is counted as first-attempt acceptance.

The downloaded static-delivery attachment records the failed shard starting
at12782.6ms and ending at14295.9ms, a1513.3ms interval, with no HTTP response.
The actual worker code deliberately aborts optional precomputed fetches after
1500ms and computes geometry locally. This timing supports that hypothesis;
the CI attachment does not record the worker's actual fallback output.
A fresh normal-TLS GET returns200/64411bytes and exact canonical
SHA256`62dceb9abec13cb09ab25fe730382241a5fbcf1817b839941e9995f9843e4697`.
Later healthy delivery does not erase the original failure or prove its cause.

An isolated CPU-only Chrome probe uses the unchanged published worker
SHA256`28b738eaf5aa3a9ba5df513fbd8c400f3d82a5f0f2624d529731c57b80a95f03`,
actual GLTFLoader-decoded supplied bodies and the real production copy/fingerprint
functions. Four classes at High/Low each run once with immediate HTTP delivery
and once with1700ms local delay. All16outputs match their committed canonical
index hashes exactly. All8delayed requests abort at1513.9–1535.2ms and produce
non-precomputed outputs within2169.9–2752.9ms; normal requests use precomputed
outputs within49.9–76.2ms. The30second delivery and1500ms fetch deadlines stay.
This proves a controlled fallback route, not live-game, render, frame-time,
phone or whole-network acceptance. The first probe could not bind occupied
loopback43911; its preflight failure is retained and the corrected harness
uses an OS-assigned loopback port without touching the existing listener.

The selected product correction addresses a separate reproducible omission:
GoogleAnalytics documents “no QA traffic” but initializes on automated production
browsers. Initialization and later manual emission now stop only when the
standard navigator.webdriver flag is exactlytrue. Normal production browsers,
closed event fields, canonical URLs, private-link suppression, tag configuration
and gameplay remain unchanged. Existing provider code cannot be unloaded by a
later flag change, and the correction makes no such claim.

Five focused regressions retain two original failures/28passes, then pass with
the correction. The complete analytics and copied-bundle suites pass45checks
in2.963s. Four real-Chrome production-host module contrasts verify the original
source loads a provider for both automated/ordinary browsers, while corrected
source makes zero provider requests for automation and retains the ordinary
provider/event route. The provider is a local routed fixture, with no actual
analytics collection. Four additional actual copied-bundle contrasts reproduce
the same result through the complete production entry. The original generated
bundle matches the freshly observed public SHA256 exactly; the corrected closed
four-module bundle is6672bytes,66bytes larger. Its ordinary tag configuration
is exactly unchanged. Focused lint and diff checks pass.

The live anonymous/persistent-character command now explicitly sets zero
retries, matching the recovery wrapper and retaining all five original files.
A command-execution regression preserves its exact failure status23 and file
union.30workflow checks/three suites pass;386version/history checks pass after
materializing the previously omitted patch-history fixture. That initial
missing-file suite failure is retained; the other three suites were not rerun.

The only runtime change is two analytics guards. Geometry algorithms, worker,
assets, budgets, browser failure policy, all gameplay assertions and
release version remain unchanged. One current82patch-note line is added; all
516previous entries remain exact. Existing46case native gameplay/preview/
connected-wardrobe evidence remains applicable to unchanged game inputs;
fresh ownCI, deployment, public assets and strict live checks are still required.
The public transport-timeout finding remains open; no collector exception or
deadline extension is selected, and the original failed run is not accepted.
Movement audio, outfit-framing work and the database client-ownership correction
remain isolated for the next coherent milestone.

Evidence is retained under
`/home/aeml/.local/share/eidolon-release82-live-diagnosis-20261018/.qa-release82-live-diagnosis/`.
Its23entry inventory is frozen at
SHA256`7671729959bc6983a6ba271c16fee8b996f823180346b1beb36f9693d1c2bec0`.
The original CI log is preserved in the owned master worktree's
`.qa-release82-corrected/live-terminal-api.log`
(SHA256`c9123a1b28e610fee20e380197ae807c9e38bfa2d2570babad5024a2887633bb`)
and its actual downloaded sanitized artifact is
`.qa-release82-corrected/live-browser-evidence.zip`
(SHA256`d7eaa2101fa1fff17c36fb1f4ad97c439c7ee6e7623797f0bd5e12b54c6f9801`).
The full original goal, prior reliability findings and all open readiness/owner
requirements remain active. Soak/stress remains deferred.
