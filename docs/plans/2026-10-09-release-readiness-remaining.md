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

- **Last accepted public build:** Alpha 1.79.31,
  `88be47c55e56b00f7d7cdb659c6ed51020391cb3`.
  [CI 38131408628](https://github.com/aeml/eidolon/actions/runs/38131408628)
  attempt 1 passed all ten ordered jobs. Post-terminal normal TLS checks at
  11:04:48 UTC verified exact frontend/backend identity, ready database and all
  nine expected asset hashes and byte counts. Optional gallery/full-rest-GPU/
  full-character/four-renderer steps remain skips, not passes.
  [Acceptance receipt](2026-10-11-public31-terminal-qualification.json).
  Accepted public 30 remains retained as historical evidence in its
  [receipt](2026-10-11-public30-terminal-qualification.json).
- Both previous 31 runs failed before deployment. Original `42f06ad0` hit the
  copied High world-review timeout; corrected `2c41890c` failed the unchanged
  conifer projected-coverage gate. All failure evidence is retained. The view
  partition keeps all nine views/72 poses/both comparisons and original timeout;
  fuller fan geometry restores the original coverage gate without changing it.
  [World-review failure](2026-10-11-release31-hosted-review-failure.json),
  [partition qualification](2026-10-11-release31-world-review-correction.json),
  [conifer failure](2026-10-11-release31-conifer-coverage-failure.json),
  [coverage correction](2026-10-11-pine-coverage-qualification.json).
- **New completed work after that push:** roof construction `e5087567` is
  ordinarily merged into local master `7a8fbfb4`; it is qualified and unpublished.
  [Roof proof](2026-10-11-town-roof-construction-qualification.json).
  Public31 is accepted; these later components remain held for a coherent next
  milestone with its own qualification and deployment verification.
- **Branch workflow:** reviewed completed work merges into `master`. Local
  unmerged tips are now **91**, reduced from 287. Unfinished/rejected experiments
  and the original dirty checkout are preserved. No blanket merge, deletion,
  reset, stash or force-push. The latest historical documentation merge adds
  a retained failure receipt and bounded test-only animation diagnostics.
  [Workflow](../../AGENTS.md),
  [original reconciliation](2026-10-11-master-branch-reconciliation.json),
  [stale-hover/rune histories](2026-10-11-stale-hover-rune-branch-reconciliation.json),
  [starter-pursuit history](2026-10-11-starter-pursuit-branch-reconciliation.json),
  [completed diagnostic histories](2026-10-11-completed-diagnostic-branch-reconciliation.json),
  [SSH guard history](2026-10-11-ssh-history-branch-reconciliation.json).
- **Existing 100-client soak:** run 38109009521 remains active on accepted public
  29 `12e5e3c4`. It is not a completed capacity gate or a test of release 31.
  The prior failed soak remains open; no retry/cancellation or unchanged campaign
  replay has been performed.

## Delivered and qualified work to preserve

| Work | Current state and limits |
| --- | --- |
| Requested jump, aura and admin fixes | Merged and accepted in public 29, retained in accepted 30 and 31. Approximately 1.5-second jump arrival, continuous takeoff/landing and network pose handling; Well Rested follows final rendered pose; automation accounts are reported separately. No final whole-game performance claim. |
| Supplied actors and equipment | Four class GLBs, equipment catalog and motion banks are delivered and integrated. Retain originals, provenance, rig/bone/morph/material/slot identity and compatibility. No replacement procedural player catalog or repeated asset request. |
| Dungeon/environment/combat/HUD milestone | Selected ground/floor/prop maps, entrance wards, regional relics, paving, shallow boss masonry, equipped motions, impact continuity, bounded contact foley and status symbols are merged and included in accepted 30. Old “private/not published” labels in dated receipts are historical. Final art, human listening, busy fights and device gates remain open. |
| Renderer/environment milestone 31 | High-only singleton batching, reviewed DemonOrc packing, camp instance clipping, display-space FXAA, rock shoulders, rooted foliage shading, pine growth/coverage, Earth map cleanup/ordered physical layers and tapered fern pinnae are merged and pushed as 88be47c5. Exact ordered publication acceptance passed; broader art/performance remains open. Earlier rejected all-quality singleton and renderer prototypes remain separate. |
| Phone fixture | The 390px Earth review uses actual phone startup policy and checks visible/reachable controls. Browser emulation and prepared poses do not establish physical-phone party/dungeon feedback. |
| Town roof construction | Two fitted gable ends and four timber edge boards per affected structure; 80 additional triangles per building, existing batches/materials/colliders/bounds retained. 30 focused and four distinct native cases pass. Actual town review covers smithy/Compact; Oathhall is constructor/unit covered, with no claim of town placement. Qualified, local master, unpublished. |

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
| Next release | Assemble the next coherent milestone from qualified local-master work, then qualify its exact publication, ordered CI/deploy/live gates and normal-TLS assets/readiness. Accepted public31 does not prequalify future source. | Implementation |
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
