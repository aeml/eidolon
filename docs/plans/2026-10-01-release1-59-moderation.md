# Alpha 1.59 moderation preparation

October 1, 2026. The appeal route, owner status lookup and actionable report review are implemented
locally but unpublished. The worktree includes accepted Alpha 1.58.2 and
accepted live Alpha 1.58.3 graphics and accepted live Alpha 1.58.4 tooltips.
No 1.59 package or milestone completion
is claimed. The full milestone
also requires abuse response, sanctions, staff boundaries and retention decisions.

## Player and staff workflow

Players select **Moderation Appeal** in the existing report form and submit a
notice reference, explanation and relevant facts. The authenticated account
creates an open report in the same private admin queue. Submission does not
reverse sanctions or disclose staff notes. Existing length limits and
acknowledgement-before-clearing behavior remain.

The same form lets players explicitly check a saved report reference. Database
queries match the authenticated submitting account and return only case type,
status and dates. Staff notes, report bodies, account identifiers and private
review receipts are excluded. Another account's reference and a missing case
produce the same unavailable response, even when the requester is an admin.
There is no background polling or persistent local reference catalog. Resolved
means review finished, not a promised fix or automatic sanction reversal.

Player safety is now reachable from a selected chat sender as well as the
existing social controls. Block and Ignore reuse the confirmed, persisted
commands. Report opens an editable draft containing only the selected message,
explicitly labeled client-reported and unverified; no conversation is collected
in the background or submitted automatically. Chat/name conduct guidance asks
for the player and approximate time. Pending submissions and drafts that would
overflow the length limit remain unchanged. Only one safety menu is open, it
names its target, and detached controls cannot act after replacement or disposal.

Admins open **Administration → Player reports**, inspect a case, enter a private
reason and explicitly confirm resolution or reopening. Cancelling does not send
a mutation. The request includes its displayed case ID, status and revision.
Every action rechecks the durable role on the current authenticated connection.
Strict fields, bounded payloads and admission rate limits apply; account roles,
report authors and arbitrary target changes cannot be supplied in the payload.

The queue now combines status with literal category filters, so conduct reports
and appeals can be triaged separately from bug reports and feature requests.
Changing either selection clears pagination and requests an explicit refresh;
both filters survive subsequent keyset pages. This is a read-only staff view,
not an automated priority judgment or a new private-data collection. Filter
controls retire when authorization is lost. Staff review boundaries are now
documented in the administrator guide; staffing and sanction policy remain open.

The database atomically stores status, revision and a private receipt containing
the actor, time and reason. A stale decision fails instead of overwriting another
review. Exact retries return the original receipt even after a later reopening;
nonce reuse with changed values fails. Corrupt receipts cannot report success.
The case retains at most 256 review receipts; browse JSON includes only the latest.

Activity history records admission, not an invented final resolution. Its fixed
summary points staff to the case receipt; report bodies and review reasons are
not copied there. Rejected authenticated attempts use fixed audit descriptions.
An admission audit failure prevents the case change. Ambiguous database outcomes
are not acknowledged as success and may be retried only with the same confirmed
request. Refresh, revocation, disconnect and disposal retire old forms.

## Local evidence

The prepared worktree now merges accepted 1.58.2 and accepted live 1.58.3,
retaining the report safety routes alongside equipment batching,
optional body-detail reload and whole-file CI distribution. Four focused
report/review/lookup/settings suites passed 66 checks in 2.702 seconds after
the merge. No moderation code or policy was published by this merge; 1.59
still requires the remaining scope and owner decisions below.

The graphics release passed all ten jobs in CI36927158308 on exact commit
e593fc213cbd9f0a8513fe325305c5dd5589a27b, including live release and character
QA. Its independent public identities, database readiness, 19 runtime hashes
and 12 critical model hashes are retained in the
[accepted release receipt](2026-10-01-release1-58-3-public.json).
No 1.59 feature was included in that deployment.

The subsequent 1.58.4 merge preserves readable equipment-type labels, red
class-restriction warnings and cumulative notes alongside the unpublished
moderation preparation. Its pushed source is
d3086750869f0515f50661e12bde7d6f84e1e204, CI36937032122. All ten exact-source
jobs passed; public identities, database readiness and five changed publisher
artifacts are verified in the [acceptance receipt](2026-10-01-release1-58-4-public.json).
No unpublished moderation code is included in that patch.
After resolving documentation-only overlaps, five focused equipment/inspection,
report, notice and binding suites passed all 111 checks in 21.635 seconds on the
busy host. No full campaign or native browser run was repeated for this merge.

Focused Go race checks passed for the handler/protocol package in 2.554 seconds
and pure database checks in 1.068 seconds. They cover strict parsing, durable role revocation, replaced
connections, audit failure, conflicts, ambiguous outcomes, receipt validation,
legacy status/revision handling and protocol registration. Client tests cover
confirmation/cancellation, captured values, duplicate-click prevention, exact
manual retry and retired forms. These are changed-scope checks, not a full
moderation or campaign acceptance claim. Four client suites passed 52 checks
in 2.589 seconds; scoped lint and whitespace checks passed.

An explicitly disposable loopback Mongo service exercised creation of an appeal,
resolution, exact replay, reopening, two competing reviewers and eight concurrent
retries of one decision. Only one competing reviewer applied; retries returned
one identical receipt and increased the revision once. Status timestamps and
the private receipt count were read back from fresh documents. The exercise
passed under the race detector in 1.103 seconds. CI runs this same test against
its job-owned Mongo service; ordinary `MONGO_URI` cannot enable it.

The existing administration layout fixture passed at 1280×720, 390×844 and
844×390 in 38.7 seconds. Confirmation controls remain at least 44px high and
within the scrollable window. Desktop and portrait renders were inspected;
after matching the input to the dark administration theme, the portrait check
passed again in 12.4 seconds and its render was reviewed. Artifacts:
`/tmp/eidolon-1-59-review-layout-1001` and
`/tmp/eidolon-1-59-review-phone-1001`. These use synthetic replies to test the real
components; server/database authorization is established separately, not by
this presentation fixture. No production case or player account was changed.

The owner-lookup slice passed focused handler/protocol race checks in 2.899
seconds and database checks in 1.119 seconds. The extended disposable Mongo
exercise passed in 5.489 seconds, also checking ownership and the restricted
status projection. Six client suites passed 389 checks in 6.421 seconds:
64 UI/binding/moderation checks and 325 existing version checks, not 389 new
moderation cases. Scoped lint and whitespace checks passed.

A race-built production server and two disposable accounts exercised real
WebSocket report submission, private admin JSON, owner-only lookup, denial of
ordinary-account resolution, confirmed admin resolution and exact retry. After
restart, the case remained resolved at revision one with one private receipt;
the staff reason remained on the case and out of activity history. The check
passed in 11.966 seconds and now runs in the existing CI socket step, sharing
its binary and job-owned database rather than adding another job. This uses an
ordinary bug report; it does not prove the still-unimplemented sanction-to-appeal
flow. The separate Mongo exercise covers appeal creation and status lookup.

The report form passed desktop and narrow-screen bounds/focus checks at
1280×800, 390×844 and 844×390. These checks exposed and fixed a keyboard trap
including hidden controls inside collapsed disclosures. A final portrait check
passed in 15.9 seconds after adding result auto-scroll; its inspected render
shows the full status explanation within the report body. Artifacts:
`/tmp/eidolon-1-59-owner-status-desktop-1001`,
`/tmp/eidolon-1-59-owner-status-phone-1001` and
`/tmp/eidolon-1-59-owner-status-readable-1001`. Final auto-scroll visibility was
verified in portrait, not re-certified at all sizes. The temporary Mongo
container was stopped and removed; production accounts and cases were untouched.

Chat safety and draft protection passed 64 checks across five client suites in
4.316 seconds. The existing community-chat fixture passed desktop and portrait
cases in 35.1 seconds, retaining private channel composition and checking an
explicit selected-message draft without copying an unrelated whisper. Both
safety renders were inspected. After including the target name in the menu
heading and protecting detached actions, the desktop case passed again in
23.7 seconds; its final render was inspected. Artifacts:
`/tmp/eidolon-1-59-chat-safety-1001` and
`/tmp/eidolon-1-59-chat-safety-named-1001`. Scoped lint and whitespace checks passed.
These are prepared presentation routes, not production reports or sanction
acceptance. Existing Go evidence covers the unchanged block/ignore authority.

## Remaining milestone scope

After merging the current asset candidate, focused lifecycle checks reproduced
three report-form failures: retained callbacks could append to a replacement
session's draft, repeated disposal could clear its reference or unlock a pending
form, and retirement during send could install an old timeout. Retired form and
lookup callbacks now stop before accessing shared controls; disposal is
idempotent. These changes do not submit reports automatically or change staff
authority, policy, retention or collection. The targeted regression checks
cover replacement while pending and transport failure after replacement.
Three focused suites passed 49 checks in 2.314 seconds, including four new
lifecycle regressions. Scoped lint and whitespace checks passed. This is local
prepared code, not a deployed moderation milestone; source documentation was
reviewed, but no rendered documentation preview was available.

The category slice passed 31 client checks in 2.434 seconds, focused handler
race checks in 2.451 seconds and pure database checks in 1.058 seconds. The
existing explicitly disposable Mongo exercise passed in 2.379 seconds: 13
appeals interleaved with 12 unrelated bug reports paginate into 10 and 3
without mixing categories, duplicating cases or changing review receipts.
Combined status/category filters, invalid and duplicate fields, and schemas
that must not accept report categories are covered. No new CI job was added.

The existing portrait administration route passed in 28.6 seconds after its
new selector was corrected to use the actual combobox role. Its screenshot
was inspected; the bright default filters were then restyled to match the
dark administration theme. The final portrait route passed again in 21.2
seconds; its inspected render retains readable status/category controls and
case review in the scrollable panel. Artifacts:
`/tmp/eidolon-1-59-report-triage-dark-1001`. This is presentation evidence, not
full moderation acceptance or a physical-phone certification. Scoped lint and
whitespace checks passed. The
uniquely named, task-labeled disposable Mongo container was stopped and
removed; production data was untouched.

The temporary-chat-mute persistence foundation is now implemented and tested
without connecting a mutating command or enforcement route. It stores account state
and a private staff receipt atomically against the immutable Mongo account ID,
not a display name. A confirmed request names a conduct case or appeal, an
explicit duration, a public explanation and a separate private reason. The store
checks the durable admin role; it does not resolve the case or claim that future
session fencing and activity admission are already implemented.

Exact retries retain the original expiry even after reversal. Reversal targets
the quoted notice, and competing decisions use an account revision check.
Expiry is read-time only, with no history purge. Private receipts are excluded
from JSON player responses. Broken saved state returns a store error, rather
than being treated as an account with no restrictions. The 30-day duration
ceiling and 256-receipt bound are storage safeguards, not approved punishment
defaults or a retention policy; the final slot remains available for reversal.
Long-term receipt handling still needs the final retention decision.

Five focused unit tests, including 32 validation/corruption subcases, and one
explicitly disposable Mongo test passed under the race detector in 1.348 seconds.
The database exercise checked eight simultaneous identical requests, competing
decisions, reversal, historical replay, role revocation, missing accounts/cases,
preserved character fields and unchanged moderation after an isolated username
field change. It uses unique test collections and the existing report-review CI
step; no extra job or campaign/browser run was added. The task-labeled disposable
container and its anonymous test volumes were removed; production data was
untouched. These checks do not prove connected chat enforcement, rename handling,
account suspensions or the complete sanction-to-appeal flow.

The prepared report form now has an explicit owner-only chat-mute notice check
and a Start appeal draft action. The authenticated connection supplies the owner;
the strict, rate-limited request accepts only a correlation ID. Database reads
project moderation fields only, and session replacement or an owner change
during the read prevents disclosure. Public responses contain only the notice
reference, explanation and dates, not staff reasons, cases or account IDs.
The UI checks only when clicked, retains no local notice catalog and starts an
editable appeal without submitting or reversing anything. Pending submissions,
oversized drafts and retired sessions remain protected.

Four client suites passed 67 checks in 2.853 seconds. Focused handler and database
race checks passed in 1.705 and 2.283 seconds, respectively; the disposable Mongo
exercise now also checks owner separation and reversal visibility. Initial
handler fixtures mistook permitted correlation IDs for invalid IDs and exceeded
the real rate limit; corrected fixtures preserve both validation and throttling.
The final 390×844 native Chrome report route passed in 15.1 seconds, including
wrapped notices, touch-sized buttons, focus, draft-only appeals and no extra
submission. Its render was inspected at
`/tmp/eidolon-1-59-owner-notice-final-20261001`. Scoped lint and whitespace checks
passed. The task-labeled Mongo container and anonymous test volumes were removed.
This is unpublished prepared code and portrait presentation evidence, not a
physical-phone check or complete moderation acceptance. No mutation handler or
live chat enforcement is enabled; full policy, action UI and connected
sanction-to-appeal acceptance remain required.

The chat service now supports an authorization check before any message is
recorded or delivered. The prepared temporary-mute guard reads authoritative
owner notices without a session cache, denies sends on unavailable or malformed
state, and rechecks the connection after the read. Denials contain only the
public reference, expiry and appeal instructions, not reasons or staff receipts.
Service startup does not install this guard yet; publication and activation
remain dependent on the approved policy and complete staff-action path.

Three new tests cover 13 channel and command routes, no delivery/history on
denial, incoming chat and unchanged character presence, immediate reversal and
exact expiry, unavailable authority, malformed state, retired/replaced sessions,
owner changes and the owner's notice route after denial. They passed with the
existing structured-chat and notice checks under the race detector in 3.148
seconds. No new CI job, browser run, campaign or production action was needed.
This is not proof of an activated sanction-to-appeal flow or a complete mute
mutation handler.

The prepared staff mutation handler now accepts an explicitly confirmed mute
or reversal for an immutable account ID, with a conduct-case reference, expected
revision, public explanation and separate private evidence. Its closed schema
rejects duplicate or unknown fields, actor overrides, missing confirmation and
non-integer durations/revisions. Durable staff authorization and the current
connection are checked before admission and again after the activity write;
the existing database mutation independently checks the durable role.

The admission audit records account/case references without either explanation.
Audit-storage failure prevents mutation. Conflicts require a refresh; an uncertain
write is not acknowledged as success and permits only an explicit identical
retry. Account state and its private receipt remain one atomic database write;
neither applying nor reversing a mute resolves the case automatically. This
handler is deliberately absent from both the protocol registry and admission
map. Target-preview and confirmation presentation are now prepared below;
approved policy, activation and connected acceptance remain open.

Five new tests, including 19 invalid payloads and four authority changes during
admission, passed with existing report-review, chat-guard and protocol checks
under the race detector in 3.387 seconds. The initial run caught a missing audit
action allowlist entry; adding that specific action fixed the handler without
weakening audit validation. Existing pure activity and moderation database
checks passed in 1.125 seconds. No Mongo/browser/campaign run or production
sanction was performed; the preceding disposable database receipt remains the
evidence for atomic retries and reversal. This is handler preparation, not full
staff-to-player sanction or appeal acceptance.

The [prepared target and staff UI record](2026-10-01-release1-59-chat-target.json)
now includes a bounded account preview and dormant confirmation controls. The
target is chosen explicitly rather than inferred from the report author. Only
the account ID, name, revision and active public notice are returned; private
receipts, saves and credentials are excluded. Role/session and audit failures
prevent disclosure. Pure projection and handler checks passed; the new Mongo
read remains part of the final disposable integration exercise, not a claimed
database proof from these unit fixtures.

The staff UI quotes case/account/revision, duration and both explanations before
a separate confirmation. Cancellation sends no change, and success or conflict
requires another account read before a new decision. Uncertain replies and
timeouts retain the exact confirmed nonce and values for manual retry only;
each server request still independently checks permissions. The UI never claims
a timeout refreshed its last-known role. The default remains hidden and the
server action/read protocols and chat enforcement remain inactive.

Four client suites passed 46 checks in 1.937 seconds. An initial control-text
fixture used a newline that the browser removes from text inputs; a retained
control character now verifies rejection. The existing 390×844 native admin
case passed in 12.8 seconds, covering explicit target selection, readable wrapped
quotes, touch-sized confirmation and unchanged synthetic case status. Its first
setup appended a second report page instead of matching normal refreshView;
resetting the list corrected that fixture without weakening its assertion. The
final screenshot was inspected in
`/tmp/eidolon-1-59-chat-mute-ui-final-20261001`. Scoped lint and whitespace passed.
This is prepared portrait UI, not a real phone or connected sanction flow. No
new CI job, campaign, production action or policy was introduced. Documentation
was source-reviewed; a rendered documentation preview was unavailable.

The owner question about initial temporary chat mutes and required name changes
versus account suspensions remains unanswered. No live sanction policy is
invented or activated. Staff coverage and final evidence-retention policy also
remain unresolved. Existing history retention defaults to 90 days; existing
cases have no automatic expiry. No report purge is introduced here.

Finish the approved abuse-response and sanction paths, document staff/review
boundaries and retention, exercise the complete disposable moderation flow,
then align versions and cumulative patch notes. Publish only after the preceding
milestones receive exact-source CI and independent public acceptance. Markdown
was source-reviewed; a rendered documentation preview was unavailable.
