# Town instancing experiment: rejected

The prototype remains isolated and unselected. It does not change deployed
Alpha 1.79.63. Its actual town CPU regression outweighs isolated draw savings.
Do not merge it or replay unchanged timing windows to obtain a favorable result.

The detached prototype is at
`/home/aeml/.local/share/eidolon-town-color-batching-20261016`, source
`78ee947ae6cda6e1b93812995a142eac84fcbcd2`, based on accepted runtime
`dc9e686b8215f11b507d8b90d203f529d407be3e`. Admission is default off and limited
to five constructor-batched town structures. Existing shader hooks, borrowed
resources, visibility restoration and late registration have 72 passing CPU
checks across three suites; scoped lint passes.

The first native High comparison failed exact triangle equality. Actor-only
shadow omission had inadvertently extended to plain-material building proxies;
the baseline buildings retain complete stock shadows. The corrected candidate
preserves that policy. Two subsequent native cases pass in 9.3 seconds, with
seven views per High/Low profile, identical triangle totals, High mean pixel
error below .025 and changed-pixel fraction below .0004. Low pixels and calls
remain exact. High calls improve in four views and regress in three; center
calls fall from132 to112. This isolated result did not establish a performance
benefit in the actual game.

One normal native client and an actual second authenticated client then used the
disposable wardrobe/Mongo/socket fixture. A completed High A-B-A comparison has
180 measured frames and60 warmups per window, 165 stable entities, zero pending
geometry jobs and zero character-preview frames. It retains nine rendered
outfit/held sections over14 real equipment slots.

| Window | Frame median / p95, ms | CPU loop median / p95, ms | Median calls | Median triangles |
| --- | --- | --- | --- | --- |
| Baseline before | 16.7 /33.3 | 16.6 /20.2 | 214 | 202043 |
| Town prototype | 16.7 /33.4 | 19.2 /24.5 | 215 | 202043 |
| Baseline restored | 16.7 /33.3 | 16.8 /19.9 | 214 | 202043 |

The ordinary frame sample passes the unchanged High timing limits in these
windows, but the prototype increases CPU time and adds a draw. Neither these
baseline observations nor isolated comparisons erase earlier original-route,
cold-start, broader population or device failures. No full performance or final
art acceptance follows.

The enclosing connected test failed later: the new optional Low tail tried to
click an already hidden character-close button and reached its300-second test
deadline. It produced no Low timing result and is not a passing complete wardrobe
case. The completed/restored High reports were written before that fixture fault;
they are sufficient to reject the prototype. No deadline was relaxed and no
unchanged timing was replayed. The accepted native wardrobe case remains separate
in [Alpha 1.79.63 acceptance](2026-10-16-release1-79-63-acceptance.md).

Actual Chrome153.0.8010.36 used AMD RADV Vulkan. The runner's backend stamp ends
in `-dirty` because its status check includes untracked QA/vendor paths; tracked
source was clean in the recorded inputs. Private credentials passed the artifact
scan. All owned services were retired and ports18243/4283 were empty after
session54369 terminated with exit1. No production accounts or access changed.

Evidence root: `.qa-town-color` in the detached tree. Preserve `native-view-*`
(first failed comparison), `native-shadow-*` (corrected strict comparisons),
`native-connected-*` (High evidence and later fixture failure), `rejection.json`
and `continuation.json`. The High report SHA-256 is recorded in `rejection.json`.
No experiment source is selected for master.

A separate constructor masonry-merge screen is also unselected at
`/home/aeml/.local/share/eidolon-town-surface-batching-20261016`, source
`91269b1c4`. Its vertex/surface/shadow census preserves source data, but merging
material bounds adds up to2548 submitted triangles at sampled camera edges.
Private `.qa-town-surface/decision.json` retains the289-view-per-structure screen.
No native execution was needed to establish that culling tradeoff.

The full original goal and original budgets remain active. Soak/stress, human
campaign pacing and physical-phone feedback remain deferred.
