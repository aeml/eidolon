# Eidolon roadmap execution goal — Alpha 1.11 through 1.99

## Objective and authority

Implement the full roadmap step by step, deploying each completed version with
synchronized login/source/server versions, cumulative patch notes and verified
deployment. Keep the full goal active; a component patch, green test or later
version number does not establish complete art, a feature freeze, beta or launch.

The complete requirements, version table, inherited decisions, gates, owner
decisions and receipts remain in
[the roadmap](docs/plans/2026-09-28-alpha1-11-to1-99-release-roadmap.md).
Modern presentation is governed by
[the art contract](docs/art/2026-09-28-modern-arpg-closed-beta.md),
not the older procedural-only aesthetic. Preserve all four supplied class GLBs,
equipment/animations and source provenance; do not ask for the already-delivered
Fighter pilot or remove approved authored models.

## Current verified state — October 9, 2026

- Last independently accepted release: **1.79.10 / d3a3b9f7**, CI37864085950.
  Later served source is not thereby accepted. Corrective11 **5bd725b9** deployed,
  but **CI37884472930 failed** live loot setup: valid NECK/GLOVES equipment was
  excluded by the test's duplicate gear list. Nine jobs and seven live cases pass;
  later animation/recovery steps skip. Read-only inspection of allowlisted QA
  inventory confirms five such single-item spares and available stash space.
  New QA-only fix **fd7bb300 / CI37888678907** is pushed and running.83 affected
  checks pass; all item/metadata/Gold conservation checks remain. No runtime,
  startup bundle, notes, accounts or economy changes. Authorized Luna
  `/root/watch_deploy_1795_1008` owns terminal-only monitoring. Root must still
  verify all required terminal gates, transformed publisher bytes and live
  frontend/backend identity/TLS/database before publishing12.
- Corrective11 bundles412engine modules only in the copied publishing tree.
  Login stays lazy, shared credentials/session module identity and import-map
  vendors remain, editable sources stay intact.438affected checks/native
  published four-class constructors pass, not authenticated-world acceptance.
  All445older raw notes and512old non-root lock entries unchanged.
  [Current integration receipt](docs/plans/2026-10-09-startup-bundle-and-air-review-progress.json)
  links the owned source receipt/artifacts. Prior SSH and static-module408
  failures and initial fixture failures remain preserved, not reclassified.
- Prepared12-17 all normally inheritfd7bb300, clean at their last source audit.
  Exact predecessor notes447-452total/ten initial per version are retained.
  Actual17graph compiles417modules/shared21; no later public push or blanket
  stage qualification. Per-release public acceptance remains mandatory.
- Air composition **d6ae6286** (f18128bc art plus fd7 QA fix) is local below: rooted
  cypresses/roughly9m slate, sheltered dust pockets, forged instruments and
  grounded chart tables, supported camp racks and folded canvas bedrolls.
  Nine dust, five instrument/path/leg and two new camp checks plus bounded
  native Low visual reviews pass (overlapping Air path reruns not added).
  Root rejected the initial bright camp cloth, then reviewed revised muted
  canvas in the existing windbreak batch, removing one separate bedroll batch.
  Root reviewed actual images;
  improvement is modest, still sparse/stylized, not final modern ARPG art.
  **High frame gate remains failed** at two views33.2/33.3ms vs original20ms.
  The later image/prop checks disable profiling and do not fix/certify that
  failure. Final419module publisher graph compiles, no release18/promotion.
  Full component receipt is in that branch at
  `docs/plans/2026-10-09-air-cypress-component-checks.json`.
- Existing nightly **37880032315/dc7** was independently confirmed running
  on the separate soak runner and remains untouched. Its concurrent host-load
  contribution to Air timings is unproven. Do not cancel/restart it or claim
  capacity completion from its existence. Owner-deferred campaign/phone checks
  remain deferred, not passed.

## Remaining scope and next work

The complete six-part scope below is unchanged. Component evidence and all
superseded observations are preserved in the history archives; historical
qualification never proves a later tree, full visual approval or public rollout.

1. Accept or diagnose corrective11/fd7bb300/CI37888678907 after authorized Luna
   terminal notice; independently verify required jobs, public identities and
   actual transformed publisher bytes. Prior dc7 attempt2 fails engine-module
   download with matching static HTTP408 evidence; upstream cause remains
   unproven. Later5bd reaches gameplay but fails the QA gear selector;83 affected
   checks qualify the fd7 correction, not live acceptance. Require own CI/public
   acceptance, then fresh-fetch/normal reconcile
   and individually publish/accept prepared12-17 in order. Never promote the
   whole future branch, overlap pushes, retry successful tests or infer acceptance
   from a running job. Continue integrated modern-world work while CI runs.
2. Finish the complete modern world/art work, not just these woodland changes:
   coherent town/realm/landmark/dungeon scenery, material scale, useful populated
   spaces, natural geological/foliage variety, lighting, fit and responsive
   combat. Reviewed scenes still have broad brown-green floor fields, repeated
   prop silhouettes and limited formation variety. Technical passes are not
   modern-ARPG art approval or a claim of Diablo/PoE production equivalence.
   Equipment inspection finds compatible fitted gear already shares exact
   ordered-bone/inverse skeletons and eligible opaque batches. Do not add a
   duplicate rig-sharing layer or alter supplied rigs on speculation; use the
   retained matched equipped-party scene to identify the remaining hot work.
3. Complete and deliver staged raised-Earth terrain/outcrop compatibility,
   renderer changes and all-family wearable derivatives only after their
   applicable rendering/placement/movement/effects/returning-save and equipped
   party/device gates. Raised profile remains disabled in ordinary public worlds.
   Single-renderer/three-live-peer evidence is not four-browser or sustained
   device qualification; do not invent party budgets or round strict failures.
4. Finish **1.80 F1–F5** promise/security/population/operations/catalog freeze
   reconciliation; all remain open, not waived by component releases. Retain
   accepted capacity evidence without promising every 100-player workload.
5. Complete the full **1.81–1.99** operations, recovery, rights, performance,
   support, qualification and handoff milestones. Near-complete closed beta
   requires explicit owner go/no-go, keeps existing accounts/characters and
   admits new players by invitation; 100 is a planning target, not a capacity
   guarantee. The 1.90 admission review/implementation is not already delivered.
6. Owner decisions on rights, deployment policy, service/cost/support ownership,
   off-machine recovery destination/RPO/RTO and any future commerce safeguards
   remain explicit roadmap gates. No invented license, SLA or purchase method.
   Human campaign/pacing and physical-phone dungeon/party feedback are deferred
   to the owner/cohort, not certified by synthetic tests.

## Workspaces and delivery discipline

- Do not edit/stage the dirty original `/home/aeml/Github/eidolon` worktree.
  Preserve unrelated user/website-agent changes.
- Current corrective11:
  `/home/aeml/.local/share/eidolon-startup-bundle-release-20261009`;
  branch `work/alpha-1-79-startup-bundle-current-20261009`, pushedfd7bb300.
- Air composition:
  `/home/aeml/.local/share/eidolon-air-cypress-release-20261009`;
  branch `work/alpha-1-79-air-cypress-current-20261009`, locald6ae6286.
- Ordered queued release worktrees and last clean heads:

  | Version | Worktree under `/home/aeml/.local/share/` | Head |
  | --- | --- | --- |
  | 1.79.12 | `eidolon-operations-release-U0VLQ4j8` | `3d56b5b9` |
  | 1.79.13 | `eidolon-public-monitor-release-XpKvF87O` | `bf690620` |
  | 1.79.14 | `eidolon-character-dungeon-release-llOMKtuQ` | `0e6c1a5a` |
  | 1.79.15 | `eidolon-render-current-jdPpzQnN` | `6135a833` |
  | 1.79.16 | `eidolon-masonry-release-CkTEzcx0` | `cb78814c` |
  | 1.79.17 | `eidolon-air-passage-release-KzBO8WOW` | `4e086eab` |

- Future graphics: `/home/aeml/.local/share/eidolon-release-1792-wzYSrZ2Y`,
  branch `work/alpha-1-87-floor-current-20261008`. Qualified staged work is not
  public acceptance. Recovery/freeze worktrees remain separate.
- Before publishing: fetch and reconcile latest master, preserve ancestry and
  the website work, no force/reset. Apply patches for local source edits.
- Verify proportionately: changed behavior/integration only; reuse unchanged
  evidence. Do not replay campaigns, soak or 100-player qualification for each
  component. Preserve all geometry/population/shadow/frame/draw/triangle budgets.
  Inspect actual gameplay-camera artifacts; do not accept art solely from tests.
- Check native resource availability before local GPU runs; avoid competing
  against CI Chrome. A timeout is not a terminal result or permission to restart.
- User authorizes **Luna only for deployment and long dungeon/raid/party
  monitoring**. Reuse `/root/watch_deploy_1795_1008`; watch exact run/head, report
  terminal/actionable failures, no automatic cancel/retry. Root separately
  confirms final exact CI/public identity and actual publisher-byte scope.
- Public checks: verified HTTPS/ordinary DNS, forced IPv4, frontend
  `/release.json`, backend `/healthz` and ready DB. Owner-deferred IPv6 is not
  resolved by an IPv4 pass. No secret/raw-auth-log dumps.
- No new payments, EP-to-Gold conversion, DNS/retention/deletion/branch-rule
  changes, production grants, restores or unsolicited emails. Keep approved
  alert policy and existing privacy/provider settings; all scope/permissions
  remain governed by the user's decisions and current roadmap.

## Preserved history

[Full October9 execution record](docs/plans/2026-10-09-roadmap-execution-history.json)
retains the entire pre-consolidation735-line goal byte-for-byte, including every
scoped pass/failure, process/source reference and historical statement. Its
SHA256 and original commit are stored beside the text. This is evidence/history,
not current acceptance or a replacement for the full objective.
[Earlier full goal history](goal-execution-history-2026-10-08.md) remains untouched.
No roadmap requirement, original scope, owner decision or receipt was discarded.
