# Connected recruitment, consent and party recovery

Accepted against the actual **f2fdea9b / Alpha1.9.13 runtime** using an owned
loopback production server and Mongo, three real WebSocket clients, and ordinary
fresh Fighter, Cleric and Rogue characters. No prepared levels/equipment, grants,
world mutation, accelerated time or production-account writes.

`TestGroupFinderActualSocketsConsentPrivacyAndReady` covers:

- Fighter posts a world-recruitment listing seeking a healer. A spoofed ownerId
  cannot transfer ownership; the server uses the caller's identity.
- Cleric finds and applies as healer. The listing still has one member until
  explicit party invitation and acceptance. The leader sees the application;
  neither the applicant nor the Rogue observer receives the private applicant list.
- Ordinary invite/accept creates the same two-member party on both connections,
  with Fighter tank and Cleric support roles. Joined applications are removed.
- Both clients receive the ready-check state before responding; both receive the
  all-ready result. This follows the UI's ordering rather than racing an answer
  ahead of the leader's ready-check request.
- Cleric disconnects, completes its real saved disconnect, then resumes through
  a new WebSocket with a rotated token. The same roster and leader arrive without
  any leader action. The production one-second party loop supplies this update;
  an initially suspected initial-snapshot omission did **not** require a fix.
- Cleric explicitly leaves, the leader's listing returns to one member, and
  removing the listing clears it for the observer. Final saves remain level1,
  Gold0, EP0, XP0 for all three characters.

## Retained results

First recruitment-only native96222 passed **1.232s**. Extended recovery run43111
passed **1.952s**, no failed or retried invocation. These are terminal results,
not active sessions. Existing block/ownership handler test passed0.059s;
`gofmt` and `git diff --check` passed. No gameplay source changed.

Artifacts: `/tmp/eidolon-group-sockets-20260914-WJG4y2/run.log` and
`resume-before.log` (the latter **passed**, despite its anticipatory filename).
Accepted extended server log: `/tmp/eidolon-compat-session-3224335432/server.log`.
The first server log is `/tmp/eidolon-compat-session-2748430786/server.log`.
Both owned server processes shut down normally; containers
`eidolon-group-sockets-0914a` and `eidolon-group-sockets-0914b` were removed by
their wrappers. No local GPU session was started alongside CI.

This proves connected recruitment/consent/readiness/token recovery, not rendered
Groups UI, cross-restart persistent parties, actual raid combat, guild-calendar
invitations, network block enforcement, or physical-phone play. Retain existing
prepared-party dungeon and arena acceptance separately. Do not rerun this route
for documentation-only changes or trigger an extra deployment for QA alone.
