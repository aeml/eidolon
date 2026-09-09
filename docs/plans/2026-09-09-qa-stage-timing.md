# QA stage timing — helper acceptance

New `scripts/qa-stage-timing.sh` provides a sourceable `run_qa_stage` helper.
It emits JSON start/end markers with a public stage identifier, integer elapsed
seconds and the command's exit status. It never prints command arguments or
environment values. Labels are validated before any command executes.

It is not yet sourced by the isolated runner: that script is currently executing
the frozen Fighter62895 playthrough and must not be edited underneath it. Wire
the helper into the existing required AND-chain once that owned process is
terminal, preserving every command and its failure/cleanup behavior. Wrapped
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

No game runtime, active pipeline, queued release, credential or disposable
service changed. The Fighter run still describes its original cleanf3f33e1
source; only this new inactive helper/test/document were added afterward.
