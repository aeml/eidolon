# Alpha 1.59 moderation preparation

October 1, 2026. The appeal route, owner status lookup and actionable report review are implemented
locally but unpublished. The worktree includes accepted Alpha 1.58.2 and the
published Alpha 1.58.3 graphics candidate; no 1.59 package or milestone completion
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
