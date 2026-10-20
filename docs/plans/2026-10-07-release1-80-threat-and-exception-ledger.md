# 1.80 threat review and freeze exceptions

Reviewed baseline: accepted Alpha1.79.0,
`b5c3981e060d6dea3ef50c9c2b4abb37999856db`. The origin correction below is
local successor work, not yet deployed. This review maps adversarial inputs to
actual boundaries and retained evidence; it is not a penetration certificate,
an assertion that no exploits exist, or approval to freeze/publish the game.

## Current-source review — October 20

The [1.80 freeze review](2026-10-20-feature-freeze-review.md#current-threats-and-remaining-risks)
now reconciles these boundaries against accepted 86 source `4 bfafdd 62` and its unchanged
master follow-up. It explicitly reviews the later invitation, quest reward/cast,
roof/melee, garment, casino privacy/value and delivery/artifact changes. Current
accepted whole-suite/race/actual-socket CI evidence retains its original scope;
no duplicate broad run or blanket security certification occurs.

X01 origin validation, X02 trusted SSH endpoint pinning and X10 artifact-publication
privacy corrections are delivered in accepted releases; their earlier prepared/
pending labels below are historical. Fresh read-only GitHub API still reports
master unprotected and no rulesets, so X03 repository/runner policy remains 1.82 work.
X04–X09 retain their named monitoring/recovery/art/rights/human/operating gates.
The owner has now confirmed F3/F4 operating responsibility/budget; F5 has a
locked candidate baseline. The candidate still requires its own release checks. No administrative setting, public admission, retention or asset license
is changed by this review. Original threat descriptions and failures remain.

## Assets, actors and trust boundaries

Protect account ownership and recovery links; exact character/item/Gold/EP
custody; progression and instance eligibility; private reports/activity/exports;
service availability; deployment credentials and original save journals.
Adversaries include unauthenticated transports, authenticated malicious players,
stale/replaced sessions and untrusted names/chat/report text. Compromised admins,
runner or host operators can cross privileged boundaries; role checks alone do
not protect against stolen privileged credentials. Network interruption, unknown
storage acknowledgements and process termination are failure threats even
without a malicious actor.

Origin filtering is a browser-facing admission guard, not authentication:
native clients can omit/forge Origin and must still pass all session/command
checks. Local Docker health cannot certify public reachability or whole-host
survival. Do not turn these limitations into broader security claims.

| Boundary / attacker attempt | Actual controls and source | Evidence / remaining limit |
| --- | --- | --- |
| Browser origin spoofing or malformed headers | `server/main.go` upgrader: exact allowed hosts; local correction validates one HTTP(S) origin tuple, no URL credentials/path/query/fragment and valid numeric port | `server/origin_migration_test.go` exercises real handshakes, duplicate headers and native omission. New regressions failed on baseline, passed after correction. Does not prevent native-client impersonation without credentials |
| Transport floods, slow assembly and forged messages | `http_server.go`, `websocket_admission.go`, `network.go`, `inbound_frame_guard.go`, `protocol_policy.go`: finite deadlines/process slots, bounded assembly/frame budgets, explicit command access/payload/rate policies | Retain1.77/1.79 evidence and focused admission/protocol race checks. Not distributed-DDoS protection; proxies and host resources remain separate |
| Credential work exhaustion, replaced-owner login | `credential_admission.go`, `client_dispatch.go`: global work slots, bounded sixteen/250ms login queue, account attempt budgets, transport/account identity rechecks | Accepted1.71 and1.79 receipts plus changed-runtime review. Queue limits do not certify resistance to all credential stuffing |
| Stolen/replayed resume or emailed recovery link | `main.go`, `email_recovery.go`, database `email_recovery.go`: random32-byte tokens, disconnected-owner-only single use, expiry; stored recovery digests and saved reset/session invalidation | Accepted1.71 connected/provider-isolated recovery evidence. Bearer-link compromise remains a threat; provider45-day retention is unchanged |
| Forged administrator identity or role revocation during IO | `admin_console_handlers.go`, `admin_roles.go`, `admin_mutation_requests.go`: closed request schemas, durable role/current connection, audit and post-IO recheck; durable original mutations recover without granting new authority | [Permission review](2026-10-04-release1-74-permission-review.json) and accepted1.74/1.75 paths. Bootstrap/QA/VIP identity is not an admin role |
| Economic replay, unknown save acknowledgements or capacity overflow | Original operation identity and immutable plans; account serialization, exact full-save receipts/journals before acknowledgement, retained owed items and startup reconciliation | [Operation ledger](2026-10-03-release1-73-operation-ledger.json), accepted1.73/1.76 receipts and current shutdown review. Historical per-path scopes remain; no new universal fault-injection claim |
| Casino wallet mixing, forged seat/action or duplicate settlement | `casino_handlers.go`, `casino_gold.go`, house/poker/slot sessions: live scene/session/seat eligibility, authoritative amounts, original pending transfer and saved wallet receipts | Accepted1.61–1.70/1.73/1.75 evidence; current operation-local roster preserves live checks. EP cannot convert to Gold/power. No independent fairness certification or payment implementation |
| Client movement/attack/equipment/progression authority | `movement_budget.go`, `equipment_slots.go`, command dispatcher and game progression: server elapsed credit/finite coordinates, class/slot and actual action/instance gates | Retained movement/equipment/party/quest receipts. Current review is not a fresh complete campaign, anti-cheat or every-ability audit |
| Foreign player private progression or mismatched frame cache | Owner bypass, detached actor-pointer membership, non-owner redaction and recipient-owned baselines in state encoding | `state_recipient_privacy_test.go`, accepted1.79 changed-runtime review. Visible name/class/equipment/combat fields remain intentionally public |
| Report/notice HTML injection or unauthorized export/removal | `AdminUI.js`, `ActionErrorNotice.js`: untrusted text via textContent; static layout HTML is separate. Server-side export approval/review and current role/session checks; removal not enabled | Accepted1.74/1.75 scoped UI/privacy evidence. No automatic deletion, provider-setting changes or unsupported privacy/compliance certification |
| Loss of saves/history during normal release or API termination | Final journals join before Mongo commits; unknown commit retains journals. Stable log/DB volumes and login-history journal-before-acknowledgement | Accepted1.74.7/1.76/1.79 receipts, including all100 fresh saves and ordinary shutdown. Not an off-machine backup or whole-host power-loss proof |
| Deployment source or SSH endpoint compromise | Current master lacks protection/rulesets; current deploy performs runtime `ssh-keyscan`. Existing workflow action pins do not fix either trust boundary | Open issues below; prepared1.82 contains trusted local-key pin and workflow guards, not installed/accepted yet |

## Launch-critical issue and exception policy

These are named remaining requirements, not waived promises or fabricated new
bugs. Agent owns scoped implementation/verification; owner retains policy,
external infrastructure and final acceptance decisions. All remain in the full
roadmap. A later version number cannot substitute for proof.

| ID | Requirement / current state | Next milestone / owner / acceptance |
| --- | --- | --- |
| X01 | Origin tuple/cardinality gap reproduced and corrected locally | Prepared1.79.1 candidate includes the correction; current-version handshake suites pass race1.080s after earlier1.122s scoped admission/protocol checks. Its own CI/live acceptance is still required; no new account authorization policy |
| X02 | Runtime SSH key discovery does not establish endpoint trust |1.82 agent: selectively integrate prepared trusted pin/strict checking; verify current final outgoing workflow and its own deployment, never paste private keys |
| X03 | Unprotected master/no rulesets; runner/release trust needs explicit policy |1.82 agent/owner: distinguish code guards from repository-setting authorization; no unrequested admin setting mutation |
| X04 | Installed alerts cover local API/DB only. Optional bounded public login/manifest/API checks staged October8, not enabled; same-host structural checks do not cover browser execution or whole-host failure |1.81–1.83/1.94: qualify activation/transition and owner-approved off-machine coverage; [preparation evidence](2026-10-08-public-monitor-checks.json). Existing self-hosting/Postmark approval is not approval for a new paid service |
| X05 | Off-machine backup destination, RPO/RTO and recovery ownership undecided |1.81/1.89 owner policy plus agent rehearsal with disposable saves. Do not copy private data off-machine, promise recovery times or delete existing backups without scope |
| X06 | Modern environment/actor/equipment quality and raised-Earth production delivery remain incomplete |1.86–1.90 agent: preserve all supplied art; integrate qualified improvements and actual all-family/readability proof. Staged1.87 now passes all three Low and two High original triangle limits; High woodland278135 still exceeds250000. Prepared1.79.1 brings only scoped ground/material and equipment failure-path fixes, not the future renderer or raised-world delivery. No lowered budgets, hidden scenery or final-art assertion |
| X07 | Project/full asset/dependency rights review and notice catalog not complete |1.86 owner/agent: inventory exact shipped inputs/notices and resolve unknown rights; do not invent a license grant. Frozen bytes alone never establish rights |
| X08 | Human campaign/party/finale pacing and physical-phone dungeon feedback are not measured | Owner/cohort before launch acceptance. Current explicit playtest deferrals stand; no repeated long automated campaign or fabricated human approval |
| X09 | Service objectives, budget bounds, support/moderation staffing and final retention/recovery coordination are not all chosen |1.80 F3/F4 and1.81–1.96 owner/agent: retain existing approved hosting/recipients/retention and100-player planning target without SLA/concurrency guarantee |

Until F1–F5 are actually satisfied, status remains preparation, not freeze.
After freeze, any catalog/dependency addition, new system or substantive policy
change must name the original requirement or explicit approved exception,
affected saved-data/authority/rendering surfaces, bounded checks, rollback and
exact release receipt. Existing scheduled art, compatibility, recovery and
operations qualification is not permission to skip its own evidence or reduce
the requested final quality. New unrelated features require explicit scheduling.
Do not change dependencies merely to manufacture a new release.

Checks for this correction: both handshake suites first failed on the accepted
runtime; scoped race-enabled origin, connection-admission and protocol tests
then passed. No production writes, credential exposure, mail, benchmark or
campaign repetition. This ledger reviews F2 and records exceptions; open issues
and F3/F4 decisions still prevent claiming a complete1.80 freeze.


## October16 current transport-trust update

The earlier baseline rows retain their dated evidence. SSH now uses the trusted
repository host pin, BatchMode and strict host checking; accepted61CI/sourcea60
and its deployment receipt prove that scoped X02 delivery. This does not resolve
master protection/runner-policy decisions or complete F2.

**X10 — Pages upstream certificate verification:** current game proxy directive
inspection finds SNI/name but no verification or CA override in the readable
inheritance chain. Nginx defaults verification to off. The actual local1.24.0
fixture demonstrates the original template accepting untrusted, expired and
wrong-name peers. The corrected template rejects all three with502, accepts the
valid peer and preserves SNI, Host, asset path and escaped release query; eight
configured/control cases and10focused guards pass.
[Qualification](2026-10-16-pages-upstream-tls-qualification.json),
[operator activation guide](../operations/pages-upstream-tls.md).
The live GitHub peer passes the host's normal CA/depth3 preflight. The game site
is root-owned0644 and noninteractive SSH sudo requires a password, so activation
remains an administrator action. No protected-file write, privilege bypass or
production reload occurred. Template selection alone does not close X10/F2.
The earlier HTTP408/shard-abort causes, other named exceptions and full original
readiness gates remain open. No soak/stress or production data/access change.


October16 scoped delivery: acceptedAlpha1.79.62 includes the secure template
and private actual-Nginx checker in mandatory hosted CI. Eight certificate/
control cases pass. Installed host activation remains pending administrator
execution; X10/F2 is not closed.
[Acceptance](2026-10-16-release1-79-62-acceptance.md).

October18 scoped QA-artifact finding: the isolated wrapper sanitized default
directories while the actual connected run configured different HTML/JSON/CLI
outputs. Decoded reports retained issued disposable fixture credentials. The
qualified82candidate now sanitizes those configured roots inside the credential-
owning wrapper and supports an exact regular JSON file without scanning neighbors.
28privacy checks and actual copied-report correction pass; original private
evidence remains unchanged. Published game/server bytes and completed46native
functional cases are unchanged by this artifact-only fix. Its release CI/live
acceptance remains pending; this does not certify all historical artifacts or F2.
[Qualification](2026-10-18-isolated-qa-output-privacy.md).
