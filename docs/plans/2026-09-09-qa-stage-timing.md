# QA stage timing — helper acceptance

New `scripts/qa-stage-timing.sh` provides a sourceable `run_qa_stage` helper.
It emits JSON start/end markers with a public stage identifier, integer elapsed
seconds and the command's exit status. It never prints command arguments or
environment values. Labels are validated before any command executes.

After Fighter62895 finished successfully, the helper was sourced by the isolated
runner and wired into all35 stages of the full required AND-chain. Every prior
command and argument remains in its original order. Focused routes are unchanged.
The timing markers cover gameplay stages, not Docker setup/readiness. Wrapped
shell functions must propagate failures explicitly, just as they must in the
existing AND-chain; this helper is not a replacement for shell error handling.

Initial30498 failed before test discovery because a Node environment override
conflicted with the repository's canvas setup. Removed that override and used
the explicit Node URL class. Corrected96999 PASS12tests2.113s: success/nonzero
status under errexit, safe labels, missing command, argument privacy, nested
labels and AND-chain early stop. Lint95966, shell syntax and diff checks pass.
Logs `/tmp/eidolon-qa-stage-timing-tests{,-fixed}.log` and
`/tmp/eidolon-qa-stage-timing-lint-final.log`. These tests are additional to the
earlier full client3682 count, not included in it.

No game runtime, active pipeline, queued release or credential changed. The
Fighter run describes its original cleanf3f33e1 source, not this later wiring.

Integration tests execute the actual all-branch and final status/scanning logic
with harmless command stubs. They check exact35-command order and arguments,
timing pairs, and all35 possible failure positions: no later stage executes,
artifact scan still runs, exit19 is retained and the EXIT hook executes. Real
Docker cleanup is not simulated as proof of Docker removal; its registration
remains unchanged and real-play runs independently verify owned resource absence.
Focused64142 PASS6suites80tests2.341s. Initial lint65347 rejected literal spaces
in a test regex; corrected to quantified spaces without changing the match.
Logs `/tmp/eidolon-qa-timing-wired-{tests,lint}.log`. Full regression and a real
full-route timing breakdown remain distinct from this shell-control-flow proof.

Final58516 PASS37 integration tests1.513s and lint after the regex-only correction;
shell syntax and diff checks also pass. Logs
`/tmp/eidolon-qa-timing-wired-{tests,lint}-final.log`.

Full95095 TERMINAL FAIL169.494s:261 suites/3730 tests passed; one assertion in
VersionPresentation still expected an untimed inline nameplate command. The
actual command remained in its original final position, covered by the executable
35-stage harness. Updated that assertion to the exact timed AND-chain call;
no release metadata, command, route, runtime or failure behavior changed.
Original full failure retained at `/tmp/eidolon-primary-timing-full-client.log`.
