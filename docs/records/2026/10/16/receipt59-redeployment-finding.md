# Alpha1.79.59 documentation-push redeployment finding

The accepted source `2c4cbb4c9` completed CI38836797920 and its independent
public verification. A later ordinary documentation push `d1a04f16b` included
root `goal.md`, which was outside CI's document ignore list. It unexpectedly
ran the full publishing workflow again under the same Alpha1.79.59 version.
All deployed game inputs are byte-identical between these two source commits;
only README, goal and Markdown evidence changed. Release query pins and both
served commit identities consequently changed to `d1a04f16b`.

[CI38842570608](https://github.com/aeml/eidolon/actions/runs/38842570608) is terminal:
nine jobs passed, including client/server, three browser shards, native
predeployment, both deployments and QA-input validation. Live main gameplay
passed eight cases with one skip. The following town-recovery phase had one
pass and one failure: the ordinary travel/combat/fresh-login Well Rested case
collected HTTP408/console/load failure for
`src/analytics/GameSessionObserver.js?release=d1a04f16b...` (`net::ERR_ABORTED`).
Later party verification was not reached. This run is **not** fully accepted.
Its failure is retained; no rerun, cancellation, target waiver or transport
root-cause claim is made.

The initial fresh comparison against the accepted `2c4cbb4c9` manifest correctly
failed123 source-pin/hash comparisons and the commit identities. A copied build
of exact `d1a04f16b`, with no changed game source, resolves all351pins. Fresh
normal-TLS verification at2026-10-16T04:38:49.544960+00:00 matches every pinned
size/SHA, both Alpha1.79.59 identities, ready database, flat-v1 and analyticsJS.
This proves current delivery integrity, not a replacement for the failed live
workflow gate. The last fully qualified implementation remains accepted59;
current public source is the runtime-equivalent documentation commit.

Alpha1.79.60 includes a reviewed trigger correction: root `goal.md` and
`ROADMAP.md` join README/docs Markdown in `paths-ignore`. Required PR checks
remain unfiltered and every mixed runtime/release-metadata push still runs the
entire gate. Six focused suites/452checks pass after the correction. The next
coherent release requires its own ordered CI/deploy/live and fresh public proof.
No soak or stress test was run.

Evidence root: `/home/aeml/.local/share/eidolon-master-20261011/.qa-release60`.
The private copy qualification is at
`/home/aeml/.local/share/eidolon-receipt59-20261016/.qa-receipt59`.
Its initial copy incorrectly preserved the external vendor symlink and the
publisher rejected it before producing a bundle; corrected copy dereferences
inputs into a new owned destination. No publication guard was weakened.
