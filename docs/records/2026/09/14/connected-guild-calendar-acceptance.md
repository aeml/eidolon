# Connected guild calendar and persistence

**Accepted:** `TestGuildCalendarActualSocketsConsentAndRestart` against the actual
f2fdea9b / Alpha1.9.13 server binary, two real WebSocket clients and an owned
loopback Mongo. Native59453 passed **4.189s**, no retry or gameplay-source change.
Characters were ordinary fresh Fighter/Cleric accounts; no grants or clock edits.

The leader created a guild and invited the member, who explicitly accepted.
Both clients then saw the same membership and a newly scheduled Earth-raid event
with matching title, activity, UTC time and revision. Scheduling does
not prove these level1 characters qualify for the raid or can complete it.

The member signed up as a healer. The leader saw that RSVP. A member cancellation
attempt was rejected; only the leader could reschedule. Both clients saw the new
time/revision and the prior RSVP become tentative. An old-revision RSVP was
rejected, followed by successful explicit consent at the new revision.

Both clients disconnected and completed their ordinary saved disconnects. The
actual server process stopped and a new one started against the same Mongo.
Fresh logins recovered both guild members, the same event identity, new time,
revision and healer RSVP without duplication. Leader cancellation propagated to
both clients at revision3. Final saved characters remained level1/XP0/Gold0/EP0.

Evidence: `/tmp/eidolon-group-sockets-20260914-WJG4y2/calendar.log`.
Server logs: `/tmp/eidolon-compat-session-3196038628/server.log` and
`/tmp/eidolon-compat-session-2998218609/server.log`.
Both owned processes shut down normally. Wrapper removed the owned
`eidolon-calendar-sockets-0914a` Mongo; no production data or native GPU session.
`gofmt` and `git diff --check` passed. This QA-only addition should ride the next
appropriate release, not supersede active CI34843057369 or trigger a docs-only
deployment. Do not repeat it for unchanged packaging.

Scope: connected guild consent/calendar/permissions/rescheduling and durable
restart recovery. Not rendered calendar usability, phone notifications, raid
participation/combat, or a replacement for existing governance/bank tests.
