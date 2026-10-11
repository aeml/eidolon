# Release-readiness remaining work

Current checkpoint: October 11, 2026. The full goal remains active. No feature
freeze, final modern-art acceptance, closed beta or launch has been declared.

This register records current delivery states and next actions. The complete
914-line preceding register is preserved byte-for-byte in the
[evidence history](2026-10-11-release-readiness-evidence-history.md). Its dated
private/staged/public labels describe their original checkpoints. They do not
override the current custody below. No unresolved requirement, failed trial,
owner decision or performance counterexample is waived by this consolidation.

Authoritative scope remains the [goal](../../goal.md),
[1.11–1.99 roadmap and gate checklists](2026-09-28-alpha1-11-to1-99-release-roadmap.md),
[original promise register](2026-09-28-1-11-gap-register.md),
[modern ARPG contract](../art/2026-09-28-modern-arpg-closed-beta.md),
[world/atlas contract](2026-09-28-world-population-and-atlas.md),
[freeze preparation](2026-10-06-release1-80-freeze-preparation.json) and
[threat/exception ledger](2026-10-07-release1-80-threat-and-exception-ledger.md).
Every explicit requirement in those sources remains part of the completion audit.

## Release and source custody

- **Active coherent36 milestone:** selected Earth ground, Chronicle icons, read-only content validation and restored terrain coverage are merged and pushed at`aee9c3dba85da6f11555439a3ad4476597aaada3`. CI38161891123 attempt1 is active;35remains last accepted.448distinct focused/six suites and four native publication cases pass, retries/skips0.471notes preserve470prior entries;12versions align;82asset pins prepared. Exact copied views retain High gate285210tri and Low gate106063/road91510tri above original budgets, equally before/after. No final-art/whole-game-performance clearance. [Qualification](2026-10-11-release36-earth-content-prepublication.json), [publication](2026-10-11-release36-publication.json).

- **Release33 CI correction:** its sole client asset-audit failure is reproduced
  and corrected with33 focused passing checks. Original CI is terminal failed,
  all other prerequisites passed and deployment skipped. Corrective9ce67fe3
  CI38142813857 attempt1 deployed but failed final live QA on a single browser
  network-change error; diagnosed failed-job-only attempt2 succeeded on identical
  source. Fresh post-terminal17asset/source/readiness checks accept exact33.
  [Receipt](2026-10-11-release33-client-guard-correction.json),
  [corrective publication](2026-10-11-release33-guard-corrective-publication.json).
- **Release33 live network failure:** all nine prerequisite/deployment jobs
  succeeded. Earned-rest expiry/reentry gameplay assertions passed, but the
  strict collector caught `GameSessionObserver.js` `ERR_NETWORK_CHANGED`.
  The second travel/combat/reconnect case passed. Normal-TLS exact identities,
  ready database, all17 pinned assets and the observer module now verify.
  One failed-job-only attempt2 reused successful jobs on identical source and
  succeeded. Fresh post-terminal normal-TLS17asset/source/database acceptance
  now passes; no relaxed gate or new release.
  [Retained diagnosis](2026-10-11-release33-live-network-recovery.json).
- **Release33 storage headroom:** two clean merged owned scratch worktrees
  retired after all818 ignored entries were checked against retained master;
  shared dependency symlink targets and every source commit remain intact.
  Free space2010→2795MiB during active predeploy/deployment, guard2048MiB
  unchanged. No production, CI, evidence, log or backup cleanup. This capacity
  repair does not establish deployment success.
  [Receipt](2026-10-11-release33-scratch-capacity.json).

- **Last accepted public build:** Accepted public release: Alpha1.79.35, exact
`ade204b800faa2cba8eacf1da71b100590e88d87`, CI38154778403 attempt1.
All ten ordered jobs succeed. Fresh post-terminal normal-TLS frontend/backend
identities, ready database and all78served asset hashes/byte counts match at
17:02:13UTC. Four optional stages remain skips.
  [Acceptance](2026-10-11-public35-terminal-qualification.json).
  Previous34 and its fixture/network failures remain in its
  [receipt](2026-10-11-public34-terminal-qualification.json).
- **Previous accepted public build:** Alpha1.79.32,
  `d31246e9b53fbe73bd7f59beea4c3235df30a922`.
  [CI38136326810](https://github.com/aeml/eidolon/actions/runs/38136326810)
  attempt2 passed all ten ordered jobs. Post-terminal normal-TLS checks at
  12:33:35UTC verify exact frontend/backend identities, ready database and all
  nine expected served asset hashes and byte counts. Four optional steps remain
  skips. [Acceptance receipt](2026-10-11-public32-terminal-qualification.json).
  Prior accepted31 and30 remain historical evidence in their retained receipts.
- Both previous 31 runs failed before deployment. Original `42f06ad0` hit the
  copied High world-review timeout; corrected `2c41890c` failed the unchanged
  conifer projected-coverage gate. All failure evidence is retained. The view
  partition keeps all nine views/72 poses/both comparisons and original timeout;
  fuller fan geometry restores the original coverage gate without changing it.
  [World-review failure](2026-10-11-release31-hosted-review-failure.json),
  [partition qualification](2026-10-11-release31-world-review-correction.json),
  [conifer failure](2026-10-11-release31-conifer-coverage-failure.json),
  [coverage correction](2026-10-11-pine-coverage-qualification.json).
- **Accepted32 milestone:** roof construction `e5087567`, shared understory
  ownership `6bd45546` and directional geological faces `26a915de` are merged,
  published and accepted within their original scoped qualification.467 cumulative
  notes and all12 release-version paths remain synchronized.429 focused checks
  and five distinct native publication cases pass. Initial missed version paths
  and affected-only corrections remain retained. Attempt1 refused storage before
  build/service replacement,1675MiB against unchanged2048MiB. Verified clean
  merged scratch retirement restored3104MiB; one failed-job-only attempt2 reused
  passing prerequisites, deployed successfully and passed live QA. No production
  data deletion or lowered storage guard. Current public terrain remains flat-v1.
  [Failure and repair](2026-10-11-release32-storage-preflight-recovery.json),
  [publication](2026-10-11-release32-publication.json),
  [prepublication](2026-10-11-release32-world-resources-prepublication.json).
- **Accepted33 milestone:** qualified birch/recovery/account-help/Player Guide/
  authoring/lore changes are ordinarily pushed with test-only correction as exact `9ce67fe3d2d0aeae55102d14b579107733d1a719`,
  corrective CI38142813857 attempt2 accepted after diagnosed transient-network
  live failure, for one coherent publication.
 429distinct release checks/four suites and8distinct browser publication cases
  pass, retries/skips0. All12 version paths align33;468cumulative notes retain
  every467prior entry byte-exact. Initial missed CI deployment version is retained
  as428pass/1fail; affected386pass after correction, unchanged43 reused.
  Prepared copied-publication identity/help/guide/lore/history flows pass. Final
  source publication pins17assets, including current authored catalog and notices.
  [Publication custody](2026-10-11-release33-publication.json).
  Own ordered CI/deploy/live/public acceptance passes within the original scope;
  component qualifications below retain their limits.
  [Prepublication](2026-10-11-release33-support-recovery-prepublication.json).
- **Later qualified work:** connected, overlapping birch crowns `323e500c`
  are merged into master and accepted with33. Forty focused
  checks and nine distinct native cases qualify High/Low/phone, current flat
  world and copied publication. Forty-five reference-again pairs are exact;
  legitimate expanded visibility adds up to2draws/2048triangles while original
  sampled limits pass. Root720vertices/UVs/normals/transform and all geometry
  counts remain exact;38of41part records unchanged. Initial7.186mm root-shift
  diagnostic and copied-fixture ENOSPC failure remain recorded, with only
  affected cases rechecked. Five owned reproducible publication copies removed
  after every pinned asset matched; manifests, source and evidence preserved.
  [Birch qualification](2026-10-11-birch-connected-crown-qualification.json).
- **Recovery integrity:** completed staged recovery work is now ordinarily merged
  into master at `67267986`, with current-source path corrections `d81b1ef8`.
  Read-only fixed-artifact SHA/gzip verification precedes Docker access for a
  coordinated restore point. Trailing symlink and `/./` missing-marker bypasses
  were reproduced and corrected. Sixty-six distinct focused/disposable checks
  qualify current guards, generated backup sets, schema25 BSON custody and saved
  boss checkpoint consumption. All three owned test projects are cleaned up.
  Existing actual archive restore is enrolled in CI. Accepted with33 within
  these scoped checks; production
  restore, off-machine recovery, RPO/RTO and final rehearsal remain open.
  [Recovery qualification](2026-10-11-recovery-integrity-qualification.json).
- **Player support and guide:** current-source account/progress help and six
  Player Guide chapters are qualified and ordinarily merged at `f4efe198`,
  accepted with33 within the retained scope.137 distinct UI checks/eight suites,48 Go guard cases, one actual
  disposable Mongo handler/store/review case and seven distinct native desktop/
  phone/landscape cases pass. Eight other conditional Mongo cases remain skips,
  not passes. Dependency setup and old text/scroll fixture failures are retained;
  only affected cases rechecked. Existing newer paired public monitoring stays
  byte-exact; older monitoring history is reconciled without another runtime.
  [Support/guide qualification](2026-10-11-support-player-guide-qualification.json).
- **Content authoring/lore:** selected `aff0fe10` is ordinarily merged after
  current-source adaptation at `596c170f`, qualified at `3d00395d`, pushed with33
  and accepted with33 within the retained scope.
  Read-only/import-safe asset validation retains exact744-path catalog, selected
  bodies/wearables and all retained baselines.58 distinct focused checks/seven
  suites and two actual Chrome desktop/phone lore cases pass with no retries or
  skips. Fixed close header stays clear while keyboard End reaches the complete
  ending; no quest/reward/network mutation.29 local contributor/provenance links
  and both copied package notices verify. Complete rights/1.86/campaign/device
  gates remain open. [Qualification](2026-10-11-content-authoring-qualification.json).
- **Selected Earth ground composition:**64679263 is qualified and ordinarily
  merged into master. Existing packed texture channels supply visible dry thatch
  and living grass color/roughness/relief, with unchanged macro mask, standing
  plants, geometry, collisions and GPU resource counts. Conservative stamps
  retain exact analytic High/Low RGBA while reducing preparation overhead.
 48distinct focused checks/five suites and two distinct native cases qualify
  eight paired views with full four-class14-slot outfits/HUD. Eight settled
  ABBA120-frame samples pass original budgets after correcting High shadow
  focus. Five browser case executions retain the initial150-module network
  failure; an earlier High timing sample is excluded as a fixture error.
  High gate285210tri and Low gate88749/road85030tri remain above original limits
  in paired views; no whole-game performance or final-art clearance.
 39native cases (including both new cases) and355ordinary browser cases are
  discovered, not all newly executed. Included in pushed36; deployment acceptance pending.
  [Qualification](2026-10-11-earth-thatch-composition-qualification.json).
- **Completed terrain histories:** Moonfrost material, Earth outcrop art and
  raised-reference/checkpoint histories are reviewed and ordinarily merged.
  Current accepted35 runtime stays exact; omitted dual-profile checkpoint/floor
  assertions and visible-grove performance coverage are restored. Five distinct
  Go-race cases and two native cases/eight120-frame samples pass unchanged
  original budgets, retries/skips0. Two retained October8 receipts stay dated;
  prepared unequipped previews do not establish final art, connected equipped
  gameplay or production raised-terrain acceptance. Included in pushed36; deployment acceptance pending. [Reconciliation](2026-10-11-terrain-history-reconciliation.json).
- **Unselected turf detail:**28focused checks and two native four-class14-slot
  HUD comparisons pass; added surface preparation costs about67ms High/20ms Low
  for only marginal ordinary-zoom visual benefit. Private88eeabdb remains
  unselected with frozen evidence; no runtime/CI enrollment or budget change.
  [Selection](2026-10-11-earth-turf-unselected.json).
- **Completed current recovery history:** four historical commits through`ef7510f0` are ordinarily merged as`cd9f05f3`. All pre-existing tracked files remain byte-exact; only the dated October6 receipt is added. Five recovery source/test files exactly match qualified`d81b1ef8`, reusing its66distinct checks and retained failures. Later path-alias protections remain in force. No unchanged restore/campaign replay, production restore or new publication. [Reconciliation](2026-10-11-recovery-current-history-reconciliation.json).
- **Forge gem keyboard/refresh continuity:** qualified source`1af38973` is ordinarily merged as`eeade50f`. Native gem/socket controls expose names, selected/disabled states, visible focus and44px targets. Ordinary redraws retain scroll; inventory reorder follows the same visible gem and clears spending selection; removed/replaced items use labeled focus fallback and clear destructive choice. Existing quote guards/local resources stay unchanged.68distinct focused checks/seven suites and four distinct Chrome1280/390cases pass, retries/skips0. Seven browser executions retain one actual offscreen-focus failure; unit fixture nesting correction is retained.357CI cases are discovered exactly once, not357new passes. Source-only while36acceptance runs. [Qualification](2026-10-11-forge-gem-keyboard-qualification.json).
- **Merchant buyback keyboard and honest prices:** qualified`db3346cb` is ordinarily merged as`49b50d7b`. Named native buttons show item/stack and total Gold prices, including the server's legacy one-Gold/single-item defaults. Keyed refresh retains held-key targets, item focus and reading position; reordering reveals the focused item. Removed, invalid or ambiguous choices fall back to the named group; obsolete/disposed nodes cannot send actions.65focused checks/five suites and two actual Chrome1280/390DOM cases pass, retries/skips0.359CI cases are discovered exactly once. Initial test matcher/collector mistakes and CSS-precedence correction are retained. Synthetic callbacks/viewport emulation do not prove connected economic transactions, actual phone or GPU performance. Source-only for a coherent successor. [Qualification](2026-10-11-buyback-keyboard-qualification.json).
- **Branch workflow:** reviewed completed work merges into `master`. Local
  unmerged tips are now **60**, reduced from 287; 594 of 654 local branch names
  are already merged. Unfinished/rejected experiments
  and the original dirty checkout are preserved. No blanket merge, deletion,
  reset, stash or force-push. The latest historical merges retain dated diagnostic/release evidence and
  three additional origin-parser regression cases. Completed recovery integrity
  is also selected and merged after current-source qualification; unfinished
  future recovery/integration work remains separate. Completed support/guide and
  superseded public-probe and current authoring histories are also ancestors of master. Full scope
  remains intact.
  Eight completed1.61–1.68casino branches are now reconciled; six later joins
  preserve the current source tree exactly. The venue accessible-name/style
  omission is restored and qualified with102checks/one browser case.
  Four original privacy/notices/support/guide branches are also reconciled with
  current implementations preserved; completed geometry observer work is merged.
  [Original feature histories](2026-10-11-original-support-history-reconciliation.json),
  [privacy history](2026-10-11-original-privacy-history-reconciliation.json),
  [Casino reconciliation](2026-10-11-casino-branch-reconciliation.json),
  [Workflow](../../AGENTS.md),
  [maintenance-notice history](2026-10-11-maintenance-notice-history-reconciliation.json),
  [Whirlwind validation history](2026-10-11-whirlwind-history-reconciliation.json),
  [original reconciliation](2026-10-11-master-branch-reconciliation.json),
  [stale-hover/rune histories](2026-10-11-stale-hover-rune-branch-reconciliation.json),
  [starter-pursuit history](2026-10-11-starter-pursuit-branch-reconciliation.json),
  [completed diagnostic histories](2026-10-11-completed-diagnostic-branch-reconciliation.json),
  [SSH guard history](2026-10-11-ssh-history-branch-reconciliation.json),
  [release/atlas/casino histories](2026-10-11-completed-release-history-reconciliation.json).
  Completed original environment history `69cb2af1` and reviewed `23a5e6d6`
  are also now ordinary ancestors of master `63b884fc`, with the complete
  current source tree unchanged. Original surface/gateway fixes are already
  integrated and superseded by newer materials/architecture; no art or
  performance acceptance is inferred from ancestry.
  [Environment history](2026-10-11-environment-history-reconciliation.json).
- **Completed content-gate history:** original `ce7a0a1d` and qualified
  `54ead973` now ordinarily merged into master `22cf547a`. Read-only eleven-group
  local/CI gate, cosmetic input validation and explicit generation replace silent
  install regeneration. Current equipment validator/catalog remain byte-exact;
  all744 asset paths retained.177 distinct checks/11suites and2 System Chrome
  desktop/phone-width2D icon cases pass, no failures/retries/skips. Eleven audited
  generated outputs retain bytes/mtime through actual checks. Source-only until
  next coherent publication; full1.86/rights/gameplay/device gates remain open.
  [Reconciliation](2026-10-11-content-gate-history-reconciliation.json).
- **Merged/pushed35 milestone:** source `0a2303c1` combines the exact qualified
  guild/venue/build-menu/direct-trade runtime below in one release.728distinct
  checks/17suites, full lint, shell syntax and two native publication cases pass;
  retries/skips0. All12version paths align35;470cumulative notes preserve every
 469prior entry byte-exact. Native login/page retry and copied four-class engine
  construction pass. Component source identity checks justify reusing their
  existing focused/browser evidence. Ordinary master merge/push `ade204b8`
  completed exact CI38154778403 attempt1 with all ten jobs successful. All78copied asset pins are prepared and verified
  before owned reproducible copy retirement; source/evidence preserved. Own
  ordered CI/deploy/live and fresh post-terminal normal-TLS identities/readyDB/
  78asset checks are accepted at17:02:13UTC. Four optional stages remain skips.
  [Acceptance](2026-10-11-public35-terminal-qualification.json).
  [Publication](2026-10-11-release35-publication.json).
  [Prepublication](2026-10-11-release35-menu-review-prepublication.json).
- **Desktop build keyboard access:** native skill unlock/rune buttons now support
  Tab/Enter/Space, disabled eligibility and authoritative rune toggle state.
  Qualified175distinct checks/eight suites and four native desktop/phone-layout
  cases;352CI cases discovered exactly once, not352execution passes. Initial
  selector failures and visual Tier1 overflow correction retained. Merged locally,
  included in pushed35; accepted with35 within the retained scope.
  Prepared UI acknowledgements do not prove connected progression or whole-game
  accessibility. [Qualification](2026-10-11-desktop-build-keyboard-qualification.json).
- **Desktop build continuity:** qualified source `ec4763db`, ordinary master
  merge `d917817b`. Same-view updates preserve focused action and scroll;
  retired, detached, closed or old-character controls cannot submit.169distinct
  focused checks/eight suites and one native keyboard case pass; five browser
  executions retain original focus failure and three scroll-fixture failures.
  Actual short desktop supplies nonzero overflow; tall desktop fits all runes.
  GPU-disabled DOM/keyboard evidence and simulated acknowledgements do not
  qualify GPU, earned progression or whole-game accessibility. Merged locally,
  included in pushed35; accepted with35 within the retained scope.
  [Qualification](2026-10-11-desktop-build-continuity-qualification.json).
- **Direct trade review:** qualified source `032ac872`, ordinary master merge
  `40c39d76`. Partner updates and acknowledgements preserve newer unsent drafts;
  Confirm waits for outstanding offer requests and matching visible authority.
  Whole Gold displayed/sent identity, explicit retry, recovery input freezing,
  current-participant guards and stale-terminal handling retain server custody.
  Centered scrollable window stays above HUD with44px actions and status
  announcements.77distinct focused checks/six suites and three final native
  desktop/portrait/landscape cases pass.15browser executions retain baseline
  failure and changed-source/visual iterations;355CI cases discovered exactly
  once, not execution passes. Prepared GPU-disabled UI/simulated replies do not
  qualify durable settlement or physical-device/whole-game accessibility.
  Merged and ordinarily pushed in35; accepted with35 within the retained scope.
  [Qualification](2026-10-11-direct-trade-review-qualification.json).
- **Dungeon radar context:** selected `260ea4d3`, qualified `5e039538`, merged
  `6d904417`. Entry-room walls and corridor mouths now fit the radar; the scale
  stays fixed while walking and advancing rooms.73 focused checks and two
  distinct native desktop/phone-sized 2D cases cover all30 retained production
  layouts, with no retries/skips. Original fallback baseline has0 visible wall
  pixels; qualified normal/fallback captures show the room and open join.
  Included in prepared34; its own combined publication qualification and
  ordered release acceptance remain separate. This is
  tactical-map evidence, not connected gameplay, physical-phone or final-art
  approval. [Qualification](2026-10-11-interior-radar-context-qualification.json).
- **Mixed Rogue weapon grips:** selected `66992b94`, qualified `64e1beae`,
  ordinarily merged `f3c3533f`. Rest, walk, run and block retain each hand's
  own supplied weapon profile. Clips/actions are created only when used and
  share existing tracks; normal mixer cleanup retires them.83 focused checks
  and one native eight-class High/Low equipment case pass, including60 wrist/
  finger pose samples across all six ordered mixed loadouts; retries/skips0.
  Original corrected-fixture baseline fails all six pairs. Supplied assets,
  rigs, equipment ownership and alternating attack cadence remain intact.
  Included in prepared34; own combined publication and release acceptance
  remain separate.
  [Qualification](2026-10-11-mixed-weapon-stance-qualification.json).
- **Unselected unsigned-copy extension:** private `367dd344` preserves the
  completed experiment and exact-input measurements.37 focused checks and one
  actual16-file/118-mesh native comparison pass correctness; the incremental
  timing benefit overlaps parity. Keep its runtime separate from master. The
  larger float-copy improvement remains selected and merged.
  [Disposition](2026-10-11-unsigned-geometry-copy-disposition.json).
- **Existing 100-client soak:** run 38109009521 remains active on accepted public
  29 `12e5e3c4`. It is not a completed capacity gate or a test of release 31 or 32.
  The prior failed soak remains open; no retry/cancellation or unchanged campaign
  replay has been performed.

- **Guild calendar/recruitment integration:** selected `4238a1eb`, historical
  integration join `db108b1b`, qualified `b5d073c4`, ordinarily merged `4308ba85`.
  Replaced/cleared/disposed/expired cards retire every old action, including an
  armed cancellation. Long-calendar handoff resets recruitment scroll. Eight
  baseline cases fail; actual phone-sized handoff reproduces scrollTop402.
 116focused checks/five suites and two native desktop/phone-sized cases pass,
  retries/skips0, preserving current account/display-name/revision and explicit
  consent rules. Reviewed1.60 history is joined without replacing newer runtime;
  only its original75-line historical preparation doc is added by that join.
  Included in ordinarily pushed35; accepted with35 within the retained scope.
  [Qualification](2026-10-11-guild-calendar-action-qualification.json).
- **Prepared/pushed34 milestone:** source `c75c0f41`, qualification `0b120edc`,
  ordinary master merge `88cf2985`. Steady dungeon radar, independent mixed
  weapon grips and faster owned geometry copies combine in one publication.
  All12 version paths align34;469 cumulative notes preserve all468prior entries
  byte-exact.444distinct checks/five suites, full lint, shell syntax and four
  distinct native publication cases pass with retries/skips0. Actual High/Low
  four-class14-slot worker integration retains exact scheduler-control indices
  and pixels; five mixed Rogue stances resolve correctly. Initial local vendor
  preparation failure and affected-only rerun remain retained. Final23asset pins
  verify before owned copy retirement; ordinarily pushed exact `f7c7b9e0`,
  CI38147178300 is terminal failed: server/all three browser shards pass,
  client fixture fails and five dependent jobs skip. No34deployment. Corrective
  `3ec8bb15` uses real Three Groups in two movement fixtures, retaining every
  assertion;59focused checks/two suites pass. All23original asset pins reproduce
  exactly, then source queries rewrite to the corrective identity. Correction
  is merged locally and ordinarily pushed. Exact CI38149199718attempt1 failed
  predeploy with36native passes/one failure:179loopback ERR_NETWORK_CHANGED
  dependency failures before engine construction; GameEngine itself returned200.
  All five prerequisites passed; validation/deploy/live jobs skipped. One
  failed-job-only retry on identical source succeeded as attempt2; no gate,
  source, timeout or threshold changes. Initial failure retained.
  All ten attempt2 jobs succeed, including live town recovery/Well Rested QA.
  Fresh post-terminal normal-TLS identities, readyDB and all23asset pins pass.
  [Trace diagnosis/retry](2026-10-11-release34-predeploy-network-retry.json).
  Exact corrected34 acceptance passes within its retained scope.
  [Acceptance](2026-10-11-public34-terminal-qualification.json).
  [Failure/correction](2026-10-11-release34-charging-fixture-correction.json),
  [Corrective preparation](2026-10-11-release34-corrective-preparation.json),
  [Corrective publication](2026-10-11-release34-corrective-publication.json).
  [Publication](2026-10-11-release34-publication.json).
  [Prepublication](2026-10-11-release34-motion-navigation-prepublication.json).
- **Next qualified optimization:** exact worker geometry copies avoid component
  decoding for ordinary packed/interleaved float buffers.90 focused checks, full
  lint and one actual GLTFLoader16source/118mesh case pass; complete character
  producer ABBA medians8.4–13.4ms→4.2–5.9ms. Qualified8c4e916d is merged
  locally and included in accepted34 within its scoped qualification. Source/worker limits and
  all original scene/frame targets remain.
  [Qualification](2026-10-11-geometry-transfer-copy-qualification.json).

## Delivered and qualified work to preserve

| Work | Current state and limits |
| --- | --- |
| Requested jump, aura and admin fixes | Merged and accepted in public 29, retained in accepted 30–35. Approximately 1.5-second jump arrival, continuous takeoff/landing and network pose handling; Well Rested follows final rendered pose; automation accounts are reported separately. No final whole-game performance claim. |
| Supplied actors and equipment | Four class GLBs, equipment catalog and motion banks are delivered and integrated. Retain originals, provenance, rig/bone/morph/material/slot identity and compatibility. No replacement procedural player catalog or repeated asset request. |
| Dungeon/environment/combat/HUD milestone | Selected ground/floor/prop maps, entrance wards, regional relics, paving, shallow boss masonry, equipped motions, impact continuity, bounded contact foley and status symbols are merged and included in accepted 30. Old “private/not published” labels in dated receipts are historical. Final art, human listening, busy fights and device gates remain open. |
| Renderer/environment milestone 31 | High-only singleton batching, reviewed DemonOrc packing, camp instance clipping, display-space FXAA, rock shoulders, rooted foliage shading, pine growth/coverage, Earth map cleanup/ordered physical layers and tapered fern pinnae are merged and pushed as 88be47c5. Exact ordered publication acceptance passed; broader art/performance remains open. Earlier rejected all-quality singleton and renderer prototypes remain separate. |
| Phone fixture | The 390px Earth review uses actual phone startup policy and checks visible/reachable controls. Browser emulation and prepared poses do not establish physical-phone party/dungeon feedback. |
| Town roof construction | Two fitted gable ends and four timber edge boards per affected structure; 80 additional triangles per building, existing batches/materials/colliders/bounds retained. 30 focused and four distinct native cases pass. Actual town review covers smithy/Compact; Oathhall is constructor/unit covered, with no claim of town placement. Qualified, merged, published and accepted in32 within this scoped evidence. |
| Understory geometry ownership | One immutable packed recipe per field instead of 326 High/320 Low duplicates. Retained raw attribute arrays reduce 17,850,456→54,756B High and 15,932,160→49,788B Low; all 13,087/7,439 plants and exact transforms/tints retained. 51 distinct focused and four native cases qualify prepared visuals and actual retirement cycles; original phone-network and lazy-PBR-baseline test failures retained. Merged, published and accepted in32 within this scoped evidence. No whole-VRAM, startup-allocation or FPS claim. |
| Directional geological faces | One steep fault face and worn ledges within existing rock contours; all 36 flat/raised bodies retain exact bases, crowns and bounds, all triangle/attribute counts unchanged. Ten distinct focused and seven native source/copy cases pass; 45 exact reference-again pairs retain equal submissions. Qualified, merged, published and accepted in32 within this scoped evidence. Current public terrain stays flat-v1; no profile activation or final-art/device/performance claim. |

Component receipts and exact failure/ownership/image scopes remain in the
[preceding evidence register](2026-10-11-release-readiness-evidence-history.md)
and linked qualification files. Passing a scoped component check does not close
its parent presentation, gameplay, device or release gate.

## Outstanding requirements and next evidence

All rows below are open at the full requirement's scope, even where substantial
implementation and scoped acceptance exist. Reuse valid unchanged evidence and
repair concrete gaps; do not rebuild delivered systems merely because final
acceptance is incomplete.

| Requirement | Remaining work and evidence needed | Owner |
| --- | --- | --- |
| Next release | Exact35 remains accepted.36/aee9c3db is pushed, with448focused/six suites, four browser cases and82copied asset pins qualified; own CI38161891123 is active. Require its ordered CI/deploy/live success and fresh normal-TLS exact identities/readyDB/all82asset pins before another publication. Later local Forge and buyback keyboard/price work and completed recovery/Gold histories are qualified and merged, awaiting a coherent successor. | Implementation |
| Modern world and atlas | Finish coherent material scale, terrain transitions, grounded architecture, roads, vegetation/rock composition, landmarks, interiors, lighting, atmosphere and readable travel/combat spaces. Moving equipped/HUD review starts Lanternhold → Earth → fight → first dungeon, then all elemental realms/borders, dungeons/raids, Dark Realm, both casino floors and PvP. Required named places, optional interactions and accurate maps remain governed by the full world contract. Repetition, sparse rooms and broad muddy patches are not final art. | Implementation; final owner review |
| Supplied actor/equipment presentation | Finish full/mixed/cosmetic fits and material identity across all classes, weapon restrictions, dual wielding, local/remote swaps, pooling/reconnect and motion. Preserve delivered assets and approved geometry/rig constraints. | Implementation; final owner review |
| Combat, classes and audio | Validate all twelve specialization kits, attack anticipation/contact/recovery, movement, threat readability and role feel. Finish contact/audio integration and human listening/busy-group mix; essential warnings survive Low/reduced effects/mute. Prepared mixer frames or audio API calls are insufficient for full acceptance. | Implementation and playtests |
| Story and progression | Reconcile every inherited Chronicle chapter, legacy quest contract, manual acceptance/reward/handoff and level-band target. Repair actual findings; do not fabricate roughly 112-hour earned campaign/pacing proof. Human campaign/finale feedback remains owner-deferred. | Implementation and owner/cohort |
| Parties, dungeons, raids and finale | Preserve personal entry eligibility, dungeon-before-raid progression, four full raids/repair Vigils, level-100 Dark Realm/Nexus/Malachar sequence, checkpoint/reconnect/15-minute expiry and credit rules. Finish unresolved class/role/party/finale findings against appropriate actual integration evidence. | Implementation and playtests |
| Items, crafting and rewards | Finish remaining drop/gear/progression/crafting/forge/socket/respec integration and valuable-operation recovery/replay cases against original rules. No grants or reward inflation as a substitute for earned progression. | Implementation |
| Economy and social systems | Reconcile Gold/item custody, vendors/market/guild bank/manual claims, party/guild permissions, recruiting/chat and account recovery support paths. Retain settlement/provenance ledgers and investigate specific findings. | Implementation |
| PvP, seasons and events | Finish original arena/lobby/duel/season/event/endgame requirements and workable cadence/sparse-population behavior with actual permission, reward and recovery evidence. | Implementation and owner/cohort |
| Casino and cosmetics | Preserve two equally sized 46-station floors, shared physical seats/countdowns, all five games, stakes/natural payouts/settlement, Gold/EP isolation, monthly/admin allowance and cosmetic-only utility. Finish remaining final integration/readability/policy findings; no EP-to-power or unapproved real-money branch. | Implementation; policy owner |
| Administration and account ownership | Retain real-player/automation separation, role/audit/moderation/report/recovery controls; finish outstanding operational workflows and policy assignment. Buttons or tests alone do not establish staffed support. | Implementation and owner |
| Browser, phone and accessibility | Finish declared supported browsers/viewports, actual touch/keyboard/non-color/reduced-motion/settings review, returning-session usability and sustained device/resource budgets. Physical-phone party/dungeon feedback is deferred to owner playtests, not passed. | Implementation and owner/cohort |
| Whole-game performance | Meet original scene/frame limits under representative dynamic populations, equipped combat/parties, all declared profiles and supported devices. Historical failures below remain. Do not hide scenery, reduce plant populations, relax budgets or substitute isolated component samples. | Implementation |
| Capacity and transport | Observe existing 100-client soak to terminal, investigate concrete closure evidence and qualify named workload/headroom. Earlier transport failure and per-client duration/frame shortfall remain failures. A ready health endpoint is not 24-hour or general 100-player capacity acceptance. | Implementation; service decisions owner |
| Persistence and compatibility | Finish current fresh/returning saves, journal/value custody, migrations/old clients, reconnect and recovery/rollback evidence for the final candidate; preserve production accounts, characters and earned receipts. | Implementation |
| Security and release trust | Finish F2 threat/boundary/exploit review and named exceptions. Trusted SSH pin/strict checking and repository/event/ref guards are installed. Fresh read-only API still reports master unprotected; agree remaining repository/runner policy before changing administrative settings. | Implementation and owner |
| Monitoring and public exposure | Qualify actual enabled alerts/probes and required public DNS/TLS/address-family paths; same-host API/DB checks do not cover whole-host failure. Preserve approved hosting/Postmark/recipients. IPv6/DDNS and off-machine coverage decisions remain explicit. | Implementation and owner |
| Backup and recovery | Finish exact final save/migration/restore/rollback rehearsals within chosen recovery scope; resolve off-machine destination, RPO/RTO, storage/budget and ownership. No private-data export, destructive production rehearsal or invented recovery promise. | Implementation and owner |
| Support, privacy and operations | Assign service objectives/budget, alert/support/moderation/incident/maintenance/content ownership and applicable retention/recovery policies. Complete operational 1.81–1.86 and 1.87–1.89 consolidation evidence. | Implementation and owner |
| Asset/dependency rights and notices | Finish exact shipped catalog/provenance/license review, player notices/help/known issues and owner rights decisions. Supplied files or matching hashes do not grant rights. Preserve existing notices; do not invent licenses. | Implementation and owner |
| Feature freeze F1–F5 | Prove every promised mandatory feature/content item, threat boundaries, supported population/service policy, privacy/admin/recovery ownership and frozen content/dependency catalog with exception process. None of F1–F5 is declared complete by this register. | Implementation and owner |
| Near-complete beta at 1.90 | Complete preceding mandatory systems/art/usability/operations, invitation preparation, chosen cohort capacity/support and integrated candidate approval. Preserve existing-account access/progress. No beta/admission change without owner approval. | Implementation and owner |
| Findings and qualification 1.91–1.98 | Collect actual cohort evidence, reproduce/fix blockers, and complete data/security/economy/capacity/device/privacy/operations/final-content signoffs. Preparation may proceed; missing beta evidence is not a pass. | Implementation and owner/cohort |
| 1.99 and handoff | Prove every original requirement, final exact CI/live identity/assets/readiness/account smoke, support/monitor/recovery handoff and explicit owner go/no-go/public naming/carryover decision. No completion claim based on version or green CI. | Implementation and owner |

## Retained performance failures and rejected work

Original sampled targets remain High 350 calls/250,000 triangles/20ms median/
33.4ms p95 and Low 200 calls/85,000 triangles/33.4ms median/50ms p95.
Each fixture retains its original specific limits; these summary values do not
relax stricter scoped checks.

Retain High 50/66.7ms and 49.9/66.6ms frame failures, 438/384 combat and 361 party
draw peaks, 386,370/281,603/289,302/284,882/279,698 triangle counterexamples,
Low 202 calls/89,808 or 103,110 triangles, and the earlier Low woodland 83→90
regression. Different populations, later passing medians, prepared scenes or
shared-host measurements do not causally clear them. Source-specific additional
failures and raw measurements remain in the archived register and receipts.

New completed geometry observer records preparation after each actual timed frame.
The bounded four-class High sample has118pending/62settled frames;297median
draws/174,118median triangles,246,694peak,33.4msmedian/50.1msp95 fails the
unchanged20/33.4ms targets. Settled frames still have33.3msmedian. This
correlation selects no optimization, clears no prior failure and stops before
subsequent save-custody assertions. [Evidence](2026-10-11-party-startup-geometry-observation.json).

New exact matrix-upload experiment `8cf75e19` remains unselected.112focused
checks/four suites and two corrected native High/Low cases pass functional
controls, including six exact pose image pairs and all four14slot outfits.
The initial two cases used incomplete Rogue/Wizard outfits and retain that
limitation.960corrected RAF renders show normal idle/walk still dirties all
three actor matrix textures each frame; zero updates occurs only with frozen
poses. ABBA timing is mixed, including Low regressions. This rejects the
unchanged-matrix hypothesis for current normal animation; no product change or
frame/performance acceptance. [Decision](2026-10-11-actor-matrix-upload-unselected.json).

Keep rejected forest visibility, woodland spatial geometry duplication, soil
contrast, unsafe descendant/light discovery, exact matrix-product and
all-quality singleton prototypes unselected. Do not blanket-merge their work
branches. Follow concrete measured hypotheses and preserve stock invalidation,
lighting, supplied asset identity, original content and safety semantics.

## Execution discipline

Complete reviewed work merges into master. Fetch and ordinarily merge remote
changes before each push, never force-push, and publish coherent cumulative
milestones only after prior deployment custody is resolved. Preserve the original
dirty checkout and use owned worktrees. Keep implemented/qualified/merged/pushed/
deployed/verified/owner-approved states distinct.

Use proportionate changed-behavior checks and valid existing evidence. Skips are
not passes; discovery is not execution; prepared art is not normal connected
play, human pacing, physical-device or sustained performance evidence. Do not
repeat unchanged campaigns/soaks or ask again for already-deferred decisions.
Continue available implementation work while individual owner decisions remain
pending. The entire original goal stays active.
