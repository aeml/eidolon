# 1.80 threat review and freeze exceptions

Reviewed baseline: accepted Alpha1.79.0,
`b5c3981e060d6dea3ef50c9c2b4abb37999856db`. The origin correction below is
local successor work, not yet deployed. This review maps adversarial inputs to
actual boundaries and retained evidence; it is not a penetration certificate,
an assertion that no exploits exist, or approval to freeze/publish the game.

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
| X01 | Origin tuple/cardinality gap reproduced and corrected locally | Fold into1.80 candidate; focused race checks passed1.122s. Its own CI/live acceptance is still required; no new account authorization policy |
| X02 | Runtime SSH key discovery does not establish endpoint trust |1.82 agent: selectively integrate prepared trusted pin/strict checking; verify current final outgoing workflow and its own deployment, never paste private keys |
| X03 | Unprotected master/no rulesets; runner/release trust needs explicit policy |1.82 agent/owner: distinguish code guards from repository-setting authorization; no unrequested admin setting mutation |
| X04 | Alerts cover local API/DB only, not public TLS/DNS/frontend/whole host |1.81–1.83/1.94: bounded public probes and owner-approved off-machine coverage; existing self-hosting/Postmark approval is not approval for a new paid service |
| X05 | Off-machine backup destination, RPO/RTO and recovery ownership undecided |1.81/1.89 owner policy plus agent rehearsal with disposable saves. Do not copy private data off-machine, promise recovery times or delete existing backups without scope |
| X06 | Modern environment/actor/equipment quality and raised-Earth production delivery remain incomplete |1.86–1.90 agent: preserve all supplied art; integrate qualified improvements and actual all-family/readability proof. Current High and one Low raised-world triangle limits fail; no lowered budgets, hidden scenery or final-art assertion |
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
