# Alpha1.79.82 preparation: inspect your next look

This isolated candidate follows selected master17a5862eca203373d9e004d25fbbfb71f5d5458b.
It is prepared, not merged into master, pushed or deployed. Alpha1.79.81 must
complete its own CI/deployment/public acceptance first; the live game remains
Alpha1.79.80 until that evidence says otherwise.

The selected player feature is Veyra's Pose/Moment appearance inspection,
including stable main/offhand strikes, supported animation states, endpoint
scrubbing, compare-with-equipped continuity, loading/empty-selection cleanup
and the Player Guide instruction. The character portrait's existing garment
row retains its behavior. Pose inspection changes no membership, price,
ownership, gear, EP or gameplay combat rule.
[Native component qualification](2026-10-18-garment-pose-inspection.md).

The second selected component removes temporary coordinate arrays from the
existing scalar finite-box check in actor shadow filtering. Its separate127CPU
and four unchanged native component cases qualify the exact code, with
identical34pose/lighting states and unchanged flags/limits. This is a small
CPU/allocation improvement, not a whole-game FPS or performance-budget claim.
[Component qualification](2026-10-18-shadow-finite-box-qualification.md).

The UI runtime, styles and existing vendor-case file are byte-identical to the
qualified dc49a6d6bc5401d30654a1fa81276b0d6b341c73 component after rebasing onto
current master. ActorShadowInfluence is byte-identical to2a061903a. The old
qualified UI history is retained under
`refs/archive/20261018-garment-pose-qualification`. No movement-audio code,
rejected renderer experiment, paired-light reuse, traversal rewrite or
unqualified grouping cache is selected. The audio source's incomplete six-case
gameplay gate and its prior failures remain open; component reuse does not
accept those failed routes.

At prepared source3091eb4b3, all692focused checks across15suites pass in20.218s,
with changed-file lint and diff checks. These cover the preview/wardrobe/vendor,
existing shadow/view/instance/foliage rules, privacy, recall helper policy,
browser/native stage enrollment and version/patch-note presentation. The
components' existing native evidence is reused only for their unchanged code.
No new native/GPU attempt runs while source81 CI39127988589 is live.

The twelve synchronized release locations use1.79.82. There are517cumulative
notes, ten initially and51lazy pages. All516prior entry strings remain
byte-exact; their serialized-array SHA256 is
`22814e2f6f4d6febd8e61cc67f94d3c7ae300b783e5295e221efad7370cbc5d0`.
Model assets, dependency versions, schema27 and stationary-action protocol
remain the current selected81 inputs. This is not a paid asset-generation run.

Before publication, finish81 acceptance, qualify this assembled candidate at
its appropriate actual gameplay/publication scope, then merge selected work to
master, fetch/ordinarily merge remote changes, push once and verify its own
complete CI, native checks, deployment and served assets. Original roof/input
findings, final art/all-motion/device review, campaign, performance, operations,
feature-freeze/beta/1.99 and owner requirements stay open. No public access or
release naming changes. Soak/stress and human feedback remain deferred.
