# Alpha 1.79.60 scoped acceptance

Runtime source: `800f3acef78e36042a4232a8dac6a4b2cd1b8bf0`.
[CI38852963115](https://github.com/aeml/eidolon/actions/runs/38852963115)
completed successfully with all ten ordered jobs, including both deployments
and live gameplay/recovery. This is scoped delivery acceptance, not a clean
first-pass transport certificate or complete-game/beta approval.

Guild updates retain same-character/guild enrollment and invite drafts, message
text, leaderboard choices, caret/focus and reading offsets. Untouched messages
still follow authoritative text; context/permission changes retire stale drafts
and controls. Calendar focus survives reattachment. [Qualification](2026-10-16-guild-menu-continuity-preparation.json).

Future private-beta invitation admission, issuer, early link/privacy handling
and persistent rollback guard are implemented but **inactive**. Alpha signup
remains open. Existing login/recovery and characters are retained; no invitations
were distributed, access changed, schema migrated or privileges granted.
[Qualification](2026-10-16-beta-invitation-qualification.json),
[operator guide](../operations/beta-invitations.md).

Root goal/roadmap Markdown joins the documentation-only CI filter, preventing
acceptance-document pushes from unexpectedly republishing the game. Required PR
checks and mixed runtime pushes remain unfiltered. The QA-only party harness
supports flat/raised profiles; functional proof does not waive retained route
frame/cold-triangle failures. [Retained evidence](2026-10-16-production-flat-party-qualification.json).

Validation:

- 783 client suites / 12025 tests pass on hosted exact-source CI; server/race,
  actual disposable invitation/recovery sockets and guard checks pass.
- Hosted browser shards pass159/154/135 cases:448passes,13skips, no reported flakes.
- Required native predeployment passes88cases with one skip and no reported
  flakes. Local copied-publication login/invitation/recovery adds seven scoped
  checks at workers1/retries0; source-specific guild/invitation receipts retain
  their independent coverage without summing repeated cases.
- Live main gameplay has seven first-attempt passes, one configured-retry pass
  and one skip. The first attempt aborted immutable geometry shard
  `indices.927fa72b1036cdc4.bin` (`net::ERR_ABORTED`); the configured retry passed.
  Both town-recovery cases and one Well Rested party case pass. Four optional
  workflow steps remain skips. No manual job rerun or cancellation occurred.
- 452focused release/version/privacy checks, full lint and16content groups pass.
  495notes retain all494prior entries byte-exact, including23legacy entries
  without the newer CSS class. The initial subset-only note counter is retained.
  Optional duplicated local serial full Jest was stopped after20minutes/about4GB
  RSS; exit130 is not a pass. Required hosted full coverage completed normally.

Copied publication contains4504files/505bundled engine modules. Worker remains
`28b738eaf5aa3a9ba5df513fbd8c400f3d82a5f0f2624d529731c57b80a95f03`.
The first copied build rejected an invitation rule in the import-only CSS entry;
source800f moves it into the login component. The corrected copy and seven
native bootstrap cases pass. The first run observer accidentally selected the
separate successful Website workflow; its ten-job assertion rejected that
observation. The corrected observer verifies source **and** workflowName=CI.
Both findings remain in private evidence.

Public verification after all jobs completed: at06:00:23UTC,355of356normal-TLS
pins and both identities match; `LanternholdNeighborhood.js` returned HTTP408.
One bounded targeted read at06:01:48UTC returns the exact7978bytes/SHA. Fresh
identities at **2026-10-16T06:07:16.609623+00:00** still match source800f/Alpha1.79.60,
ready database, **registrationMode=open** and **flat-v1**. The reconciled356-pin
inventory includes the original failure and both observations. This is not a
single clean sweep. The public module and live-shard transport causes remain
open; later successful reads do not establish root-cause resolution.

[Previous documentation-push finding](2026-10-16-receipt59-redeployment-finding.md)
also remains retained. Subsequent independent Bastion wall/doorway and analytics
bundle work is isolated and unselected, awaiting native qualification. The
analytics proposal removes three module requests, not all possible transport
failures. No proxy configuration was changed during this acceptance.

Private evidence root: `/home/aeml/.local/share/eidolon-master-20261011/.qa-release60`.
Frozen22-entry inventory: `acceptance-evidence.json`, SHA-256`b0f52c116ac0d8672def9ea48f20c8b0a82aade7260d14bed9f96914a2ea115e`.

The full original goal remains active: final collection/world/combat/audio/
performance/device/gameplay, operational/rights/owner/F1–F5/beta/cohort/release/
handoff gates remain open. Human campaign pacing and physical-phone feedback
remain deferred. Soak/stress remains deferred; no new soak or stress was run.
