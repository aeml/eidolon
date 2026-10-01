# Alpha 1.59 moderation preparation

October 1, 2026. The appeal route and actionable report review are implemented
locally but unpublished. The worktree still carries the preceding Alpha 1.58
version; no 1.59 package or milestone completion is claimed. The full milestone
also requires abuse response, sanctions, staff boundaries and retention decisions.

## Player and staff workflow

Players select **Moderation Appeal** in the existing report form and submit a
notice reference, explanation and relevant facts. The authenticated account
creates an open report in the same private admin queue. Submission does not
reverse sanctions or disclose staff notes. Existing length limits and
acknowledgement-before-clearing behavior remain.

Admins open **Administration → Player reports**, inspect a case, enter a private
reason and explicitly confirm resolution or reopening. Cancelling does not send
a mutation. The request includes its displayed case ID, status and revision.
Every action rechecks the durable role on the current authenticated connection.
Strict fields, bounded payloads and admission rate limits apply; account roles,
report authors and arbitrary target changes cannot be supplied in the payload.

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

## Remaining milestone scope

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
