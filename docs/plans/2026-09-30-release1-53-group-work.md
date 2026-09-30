# Alpha 1.53 recruitment and group preparation

September 30, 2026. Preparation only. This worktree starts from the pushed
1.52 candidate e948bfd36dd2ed240fc0af450863a412fde7e378 and still reports
Alpha 1.52.0. No 1.53 implementation, verification or live acceptance is claimed.
Do not deploy this successor before exact 1.52 CI/public acceptance.

## Retained foundations

The current finder supports activity/minimum-level filters, offered/needed roles,
20-minute online listings, five-minute applications, owner-only applicant lists,
two-way blocking and normal explicit party invitations. It prunes unavailable,
expired, full and non-leader listings. Empty-board guidance names real-player
requirements rather than filling a party with bots or bypassing story gates.

Party invitation acceptance already checks the original party object, current
leadership, availability, arena participation and capacity under the world lock.
Guild calendars already provide local-time scheduling, tentative/confirmed
sign-ups and renewed consent after rescheduling. Party ready checks and canonical
world-location/atlas data exist. Extend these systems rather than creating a
second scheduler, invitation service or entry bypass.

Historical real-socket recruitment/readiness/resume evidence is recorded in the
[connected acceptance receipt](2026-09-14-connected-group-finder-acceptance.md).
It is not current-source proof for upcoming changed protocol behavior.

## Changed scope to complete

1. Give listing/application actions an immutable current-listing identity so an
   old card cannot apply to, cancel or invite from an owner’s replacement listing.
   Validate again at ordinary invitation issuance; preserve explicit acceptance
   and the existing party-object fence. Refresh instead of silently acting on a
   stale token.
2. Make recruitment plans useful: clear role needs, bounded planned start time
   and canonical public meeting point, with no automatic party creation,
   teleportation, dungeon entry or promise of a reserved raid seat. Reuse atlas
   location data and distinguish a world meeting place from an instance.
3. Show readiness/roster preparation and meeting instructions in the normal
   group/party surfaces. Review roster changes against ready-check consent; a
   prior roster’s readiness must not imply approval for a changed group.
4. Keep empty/low-population behavior useful and honest, cancellation explicit,
   applicant privacy and blocking intact, and the desktop/phone-policy layout
   readable without duplicating guild-calendar infrastructure.

## Proportionate verification and release

Use focused game/handler races for replaced listings, expired applications,
changed leadership/party objects, privacy, blocking, readiness and invalid plans;
scoped UI checks for payloads, safe text, filters, cancellation and clear meeting
instructions. Run the changed real-socket recruitment route and native prepared
UI checks once when the protocol is integrated—not an unchanged dungeon campaign.
Do not claim a physical-phone or human-party playtest from prepared fixtures.

Then package 1.53 login/runtime metadata and cumulative notes, fetch/merge remote
website changes immediately before a normal push, and require exact CI plus
independent public identity/document/changed-asset acceptance. Preserve open-alpha
access, account saves, economy and current dungeon/raid entry requirements.
