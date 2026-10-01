# Alpha 1.60 social and endgame integration preparation

October 1, 2026. This is local preparation, not a packaged or deployed 1.60
release and not closure of the S checklist. The branch inherits the unpublished
1.59 moderation work and still carries the preceding 1.58 version. Publication
must remain ordered, with each predecessor independently accepted.

## Calendar to recruitment handoff

An active guild calendar event now offers **Find companions**. It opens the
existing Groups tab for that activity, using the server's recruitment catalogue
and entry-level floor. The handoff does not copy the private calendar title,
time or sign-ups into a public listing. No posting, application, invitation,
membership, teleport or instance entry happens automatically. Later events stay
on the guild calendar; players return near the start to recruit with the
existing 20-minute listings rather than creating another scheduler or queue.

Calendar card actions are retired when a new guild view replaces them, guild
membership is lost, the event finishes or the session is disposed. This protects
recruitment, sign-ups,
invitations, editing and cancellation confirmation from detached old buttons.
An already-open edit still carries its original revision for server validation;
the changed UI does not weaken that conflict check.

The handoff resets the Social window's scroll position. A different tab's long
calendar must not hide recruitment guidance behind the sticky mobile header.

## Focused evidence

Five existing client suites passed 83 checks in 4.982 seconds, covering the
calendar, guild, finder, social and engine bindings. Added checks establish that
the calendar passes only the activity, sends no automatic mutations and retires
old card actions, lost guild membership and event expiry. These are not 83 new
integration tests. Scoped lint and
whitespace checks passed.

The existing desktop and phone-policy recruitment cases passed in 36.3 seconds.
They use real UI components and pointer input with prepared replies, retain
listing/application/invitation identities and check that the private calendar
details never prefill a listing. No new parallel browser matrix was added.
Both handoff renders were inspected; the phone render exposed the retained
scroll offset described above. Artifacts:
`/tmp/eidolon-1-60-calendar-handoff-1001`.

After correcting the scroll handoff, the portrait case passed in 19.3 seconds
and its final screenshot was reviewed: the heading, guidance and selected filter
are visible. Artifacts: `/tmp/eidolon-1-60-calendar-readable-1001`. The final
scroll correction was verified in portrait, not claimed re-certified at every
size.

This fixture is not an authenticated earned dungeon clear, a real-player
population observation or physical-phone certification. No production account,
event or reward was changed, and no broad campaign or soak was repeated.

## Remaining integration and release requirements

Keep the existing normal-party formation, ready-check and reconnect evidence
from [1.53](2026-09-30-release1-53-group-work.md), along with the accepted
party dungeon/raid and reward receipts. The
[1.58 overview](2026-10-01-release1-58-endgame.md) connects actual story and
weekly-cache status to optional next goals; it does not change reward values.
These scoped foundations are not one newly observed uninterrupted human loop.

The full S review still needs the approved
[1.59 moderation workflow](2026-10-01-release1-59-moderation.md), including
sanction scope, staff boundaries and retention. Season activation decisions
and human event/endgame pacing observations remain separate from mechanical
fixtures. Do not invent population bottlenecks, new queue splits, human playtest
results or final art approval to close the milestone.

Before publication, complete the S requirement review, align the login and
client/server/build versions and cumulative patch notes, fetch and merge current
master, then require exact-source CI and independent public acceptance. The
overall 1.11–1.99 goal and modern-art/device requirements remain open. Markdown
was source-reviewed; a rendered documentation preview was unavailable.
