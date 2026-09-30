# Alpha 1.53 recruitment and group preparation

September 30, 2026. Alpha 1.53.0 is implemented and packaged locally, starting
from Alpha 1.52, now independently accepted live. Its receipt is merged into this
candidate. Alpha 1.53 is not yet accepted live; its own exact-source CI and
independent public checks remain required.

## Retained foundations

The current finder supports activity/minimum-level filters, offered/needed roles,
20-minute online listings, five-minute applications, owner-only applicant lists,
two-way blocking and normal explicit party invitations. It prunes unavailable,
expired, full and non-leader listings. Empty-board guidance names real-player
requirements rather than filling a party with bots or bypassing story gates.

Party invitation acceptance checks the original party object, current
leadership, availability, arena participation and capacity under the world lock.
Guild calendars already provide local-time scheduling, tentative/confirmed
sign-ups and renewed consent after rescheduling. This milestone extends the
existing invitation, readiness and canonical world-location/atlas systems;
it does not introduce another scheduler or entry bypass.

Historical real-socket recruitment/readiness/resume evidence is recorded in the
[connected acceptance receipt](2026-09-14-connected-group-finder-acceptance.md).
Current-source evidence for the changed protocol is recorded below.

## Implemented group preparation

Every posted or replaced listing, application and invitation has a new identity.
Requests, removals, cancellations and leader invitations validate the current
identity; stale UI callbacks refresh rather than acting on a replacement plan.
All normal party responses also require the displayed invitation identity. An
old prompt cannot consume or accept a newer invitation from the same player.
Existing clients must refresh for the new consent protocol.

Recruitment invitation issuance checks the listing, exact application,
availability, level, party leadership and capacity under one world lock. Actual
acceptance rechecks the original party object and recruitment/application plan.
Listings bind to their recruited party object; a recreated party with the same
ID cannot inherit the old board entry. Two-way blocking remains enforced by
normal handlers. Only leaders receive applicant details; applicants receive
their own cancellation token without the private list.

Listings can specify a start within their 20-minute lifetime and a canonical
public Lanternhold meeting place. Times render locally; an empty time means
when everyone is ready. The meeting-map button uses existing atlas navigation
and refuses to select an overworld meeting place inside a different instance.
No posting/application automatically creates membership, teleports anyone,
reserves a raid seat or bypasses story/level/instance requirements. Later events
continue using the existing guild calendar. The Dark King raid is included in
the recruitment activity catalogue at level 100.

Cards show the current class-role mix and readiness count without promising
that a player's class or offered role guarantees a particular build. Joining,
leaving, kicking, new rejoin membership, expiry removal and leadership changes
clear prior readiness and require a fresh check. Same-roster reconnect recovery
is preserved. Empty-board guidance remains useful without fake teammates.

The rendered check exposed party-invite buttons beneath the open Social window's
stacking context. The consent surface now mounts at the root modal layer, is
centered and has 44px buttons. Normal session disposal hides it and clears the
invitation identity. This was fixed in production UI code; pointer checks were
not bypassed.

## Scoped verification

- Initial existing game/party race selection passed in 9.004 seconds; affected
  normal handler/protocol selection passed in 4.051 seconds.
- Added game races passed in 1.378 seconds for invalid public plans, detached
  schedule/role snapshots, replacement listings/applications, old invitation
  tokens, cancelled or changed recruitment consent, original party objects and
  all six roster/readiness transitions. The final expanded selection passed in
  3.983 seconds, including wrong-owner/token, busy/underlevel/expired applicants,
  denied invites without party creation, departure retiring its listing and
  self-kick rejection. Final affected normal handlers passed in 4.388 seconds.
- Four focused JavaScript suites passed 76 checks in 2.877 seconds, including
  safe player text, explicit payloads, stale detached controls, map behavior and
  the currently displayed invitation token. Final UI/lifecycle/version/browser
  plan checks passed across eight suites: 420 checks in 7.992 seconds. Scoped
  lint and diff whitespace checks passed. Both rendered group cases are now
  mandatory browser coverage; discovery assigns all 245 cases exactly once.
- Three real WebSocket clients using ordinary fresh Fighter, Cleric and Rogue
  characters passed the changed production flow in 12.30 seconds (13.448 seconds
  including the race test wrapper). This covers private applications, finder
  invitation issuance, normal acceptance, readiness, rotated-token resume,
  departure/removal and unchanged level/XP/Gold/EP. The first local invocation
  used a binary without the harness-required build-commit marker: the server
  started normally but the exact health identity check correctly refused it.
  The corrected build was verified without weakening that gate.
  After the final departure/listing fence changes, the same narrow real-socket
  route passed against the final candidate code in 10.04 seconds (11.123 seconds
  including the wrapper). Version metadata and complete history checks passed
  after the predecessor receipt merge: 319 checks in 2.459 seconds.
- Native System Chrome passed both desktop and phone-policy cases in 16.8
  seconds after the layering fix. Planning controls, current listing payloads,
  a stale detached button and the normal invite Accept button were exercised
  with real pointer input. Phone overflow and 44px controls were checked at
  390px and 320px. The 320px planning screenshot was visually reviewed; readable
  controls and wrapped cards were retained. Artifacts:
  `/tmp/eidolon-1-53-group-browser-fixed-0930`.

The owned socket server shut down normally. The private loopback Mongo container
was stopped and disposable data removed; production accounts were untouched.
Native UI cases use prepared client state, not authenticated multiplayer or a
physical phone. Real sockets do not prove a rendered human-party playtest or
combat pacing. No unchanged campaign/soak was run. Markdown was inspected as
source; no rendered-document preview is claimed.

## Remaining release gates

The exact 1.52 acceptance receipt is merged. Fetch/merge remote website changes
immediately before a normal push, and require exact CI plus
independent public identity/document/changed-asset acceptance. Preserve open-alpha
access, account saves, economy and current dungeon/raid entry requirements.
