# Release-readiness remaining work

Current checkpoint: October 15, 2026. The full goal remains active. No feature
freeze, final modern-art acceptance, closed beta or launch has been declared.

This register records current delivery states and next actions. The preceding
register at `e2880b4ee` is preserved byte-for-byte in the
[October 14 evidence history](2026-10-14-release-readiness-evidence-history.md)
(SHA-256 `e092ec35ffea4ce14fb1a5c1ed3a86853900fe03464a30188e664a3e9a026e33`). It retains the older
[October 11 history](2026-10-11-release-readiness-evidence-history.md) and every
linked receipt. Dated private/staged/public labels describe their original
checkpoints; they do not override current custody below. No unresolved
requirement, failed trial, owner decision or performance counterexample is
waived by this consolidation.

Authoritative scope remains the [goal](../../goal.md),
[1.11–1.99 roadmap and gate checklists](2026-09-28-alpha1-11-to1-99-release-roadmap.md),
[original promise register](2026-09-28-1-11-gap-register.md),
[modern ARPG contract](../art/2026-09-28-modern-arpg-closed-beta.md),
[world/atlas contract](2026-09-28-world-population-and-atlas.md),
[freeze preparation](2026-10-06-release1-80-freeze-preparation.json) and
[threat/exception ledger](2026-10-07-release1-80-threat-and-exception-ledger.md).
Every explicit requirement in those sources remains part of the completion audit.

## October 15 implementation checkpoint

**Alpha 1.79.52 combat feedback and reduced motion is deployed and verified** at
`8c8ef016e`. All ten jobs in CI38656850418 passed. Normal-TLS public verification
matches both identities, ready database and all 204 asset pins. Hosted browser
coverage records 388 passes, 13 skips and one Magma image-comparison retry;
770 client suites/11,772 tests, 62 native passes/one skip and live recovery pass.
[Acceptance, retained retry and custody](2026-10-15-release1-79-52-acceptance.md).

The next coherent milestone, Alpha 1.79.53, is prepared locally. Returning
phone/desktop sessions now select current input policy and restore shared menus,
settings and touch controls on teardown, including failed world loading (212 focused checks and ten distinct
native cases). World preparation preserves twelve exact High/Low maps while
bounding first-build town work and retaining at most 4,915,200 CPU bytes for
returning sessions (61 focused checks; two final native scene-lifetime cases).
[Session qualification](2026-10-15-session-layout-qualification.json),
[world preparation](2026-10-15-world-raster-preparation.json).
52 is accepted; publish 53 next and verify its own deployment independently. These changes
close specific usability/loading defects, not final world art, physical-device,
whole-frame or full original readiness requirements. Soak remains deferred.

## October 14 accepted class milestone

**Alpha 1.79.51 at `e2880b4ee` is deployed and verified.** All ten jobs in
CI38517044265 passed, including both deployments and live account/recovery QA.
Fresh 06:27:30 UTC normal-TLS verification matches both release identities, ready
database and all 199 pinned asset hashes/byte lengths.
[Acceptance and evidence custody](2026-10-14-release1-79-51-acceptance.md).

The four class passes add 96 missing rune choices: all 52 learned skills now have
three options,156 choices across twelve specializations. Paid/rejected casts,
learned breakpoints, saved builds, connected branches, native effects and
phone skill-message bounds have scoped qualification. The private 1.79.52 was
consolidated before publication. [Class review](2026-09-28-class-kit-rework.md#october-14-implementation-checkpoint),
[Wizard](2026-10-14-wizard-class-completion.json),
[Fighter](2026-10-14-fighter-class-completion.json),
[Rogue](2026-10-14-rogue-class-completion.json),
[Cleric](2026-10-14-cleric-class-completion.json) and
[phone feedback](2026-10-14-floating-skill-readability.json).
Their dated preparation labels are superseded only within this accepted scope.

Validation: 769 client suites / 11,760 tests; full server/race/recovery/build;
385 hosted browser passes / 13 skips / 0 flakes; 62 native passes / 1 skip / 0 flakes;
eight live main passes / 1 skip plus two recovery and one Well Rested party pass.
Four optional workflow stages remain skipped. The three High class-effects
cases are mandatory native checks with unchanged casts, gameplay lifetimes,
cleanup assertions and original deadlines; hosted deferrals are not passes.

Earlier 51 candidates failed before deployment on stale combo/reflection fixtures,
an unrealistic PvP healing fixture and High software retirement timeouts.
Corrections and cancelled/superseded candidates remain in the
[preparation receipt](2026-10-14-release1-79-51.json). The first public read also
retains HTTP 408/503 for two assets: targeted reads then matched both files, and
one fresh complete verification matched all 199. No universal network cause is
claimed. This completes missing rune implementation coverage; human class
balance/feel and the original world/art/device/operations/release scope stay open.

The preceding [Alpha 1.79.50 acceptance](2026-10-14-release1-79-50-acceptance.json)
retains the elite publication race fix and scoped rendering improvements.
Soak 41 ended with 7 read errors and insufficient common 100-client coverage;
soak 48 ended with a concurrent map access crash. The focused elite regression
reproduces an unsafe writer against the same reader, but does not establish the
unique historical writer or prove capacity. [Retained fix/failure](2026-10-14-elite-publication-race-fix.json).
**Soak/stress qualification is deferred by the owner until features are nearly
complete.** Automatic scheduling is disabled; prior failures remain open.

## Outstanding requirements and next evidence

All rows below are open at the full requirement's scope, even where substantial
implementation and scoped acceptance exist. Reuse valid unchanged evidence and
repair concrete gaps; do not rebuild delivered systems merely because final
acceptance is incomplete.

| Requirement | Remaining work and evidence needed | Owner |
| --- | --- | --- |
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
| Geometry delivery reliability | Qualified delivery merged into local master at `f8ebfbec`:14immutable shards≤64KiB (largest65216B), all133canonical outputs/777321bytes exact, one active request with unchanged1500ms deadline/30s retirement.132CPU checks/six suites, lint/build pass. Real native worker at64KiB/s completes all14shards/133outputs without retries (longest1006.872ms); unchanged monolith control aborts1500.7ms. Copied published actual Fighter ownership/cache/offline case passes once,7shards cached/10rearrival hits/zero remaining jobs or roots. Original fixture failures and independent vendor restoration retained. This controlled transport proof does not establish the original public45ERR_ABORTED cause or resolve separate ERR_NETWORK_CHANGED. Included and accepted in47 within this retained scope. [Native qualification](2026-10-13-geometry-download-shards-native-qualification.json). | Implementation |
| Whole-game performance | Meet original scene/frame limits under representative dynamic populations, equipped combat/parties, all declared profiles and supported devices. Historical failures below remain. Do not hide scenery, reduce plant populations, relax budgets or substitute isolated component samples. | Implementation |
| Capacity and transport | Soak41failed with7reads/970664ms common 100-client coverage and priorityOverflow7; diagnose bounded priority-lane workload without weakening policy. Later48run38342666778 failed with a concurrent map access crash; the focused elite publication fix shipped in50. Capacity/transport qualification remains deferred by owner until features are nearly complete. [Evidence](2026-10-13-soak41-terminal-failure.json). | Implementation; service decisions owner |
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

Bounded current-source Earth renderer census now separates cold and settled equipment preparation in the same native High1280/Low390 fixtures. High gate301626→147466tri and road305035→189499tri; Low gate106063→65649tri and road102486→79386tri. Draw calls stay220/274High and110/141Low. The existing preparation queue reaches0; source/runtime/visibility unchanged. All12observations have exact before/observed/restored submission totals and complete attribution. These untimed prepared views isolate startup preparation; they do not clear retained cold budgets, connected frame-time failures, real phones or final art. [Census](2026-10-11-earth-cold-settled-triangle-census.json).

## Retained performance limits and counterexamples

The static foliage batching pilot `504b44ef` remains performance-rejected and
unselected. It preserved all 901 placements and float32 matrices, but reducing
3,146 objects to 28 batches increased woodland High triangles from 244,793 to
282,189 and worsened CPU time in both profiles. Do not repeat the same batching
proposal as an untested next step. [Retained diagnosis](2026-10-13-foliage-delivery-native-diagnosis.json).

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

Preserve the original dirty checkout and use owned detached worktrees. Merge
selected, validated work into master, fetch and ordinarily merge origin before
pushing, and never force-push. Keep cumulative notes and all release versions
synchronized. Verify deployment and exact public source/assets before another
release; a successful push or healthy server is not acceptance by itself.

Reuse valid evidence for unchanged behavior. Run focused checks for actual
changes and diagnose failures before rerunning. Keep rejected experiments
isolated; historical ancestry never selects their runtime. Capacity/soak work
remains deferred by the owner. Do not substitute automated campaigns for the
owner-deferred human pacing or physical-phone playtests.

Continue implementation-owned work while external decisions are pending. Do
not invent rights, retention, support, backup, access or launch decisions.
Feature freeze, closed beta and release remain subject to the original gates
and owner approval. The full original goal stays open.
