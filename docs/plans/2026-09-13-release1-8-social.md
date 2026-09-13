# Alpha 1.8.0 — find your people

Developed separately from frozen1.7f3adf398. Runtime remains1.7 until packaging.
Preserve ordered1.6→1.7→1.8 publication and live identity verification.

Required: activity group finding, recruitment and role listings; persistent guild
event scheduling; better invitations/readiness; moderation workflows built on
existing block/report/guild authority. Add authoritative physical casino seats,
table presence, session/reconnect handling and camera/input ownership for both
desktop and phones. No remote menu-only casino or pretend multiplayer seats.

## Recruitment board checkpoint

Groups tab implemented end-to-end through character-only, bounded/rate-limited
group_finder protocol. Post Looking/Recruits listings with canonical activity
catalog, role offered/needed, actual entry-level floors, minimum level and160-char
plain-text note. One listing/player,20min online availability, global250 bound;
actual leader/capacity revalidated and unavailable/busy/full/grouped-looking
listings removed. No fictitious teammates or activity-gate bypass.

Ungrouped eligible players request a role; only owner sees applicant details,
others see their own pending flag. Requests expire5min, capped20/listing; caller
can cancel, owner can decline or explicitly invite through the existing consent
flow. No request autojoins or sends an invitation as another player. Block/ignore
filtering applies to boards and requests. Listings and invitations exclude active
PvP matches so party changes cannot turn arena opponents into allies.

UI uses existing Social window with activity filter, collapsible editor, real
counts/roles/expiry, owner requests and live15s refresh only while Groups is open.
Close/tab switching stops refresh; hidden managed windows are not polled. Safe
textContent and44px controls, wrapping four-tab header and responsive cards.
Listings/requests are deliberately session-local, not durable guild schedules.

Focused gameboard/invitation checks PASS0.046s; maincaller-ownership/private
requests/blocked visibility plus existinginvite tests PASS1.003s; JS48tests over
GroupFinderUI/SocialUIFriends/UIBindings PASS7.656s; changedJS lint/build/diffPASS.
The first attempted SocialUI.test.js name did not exist; actualSocialUIFriends
suite used in the passing selection. Focused SystemChrome Groups phone-width
390/320 action/layout case PASS12.2s; standalone group-finder.spec.js remains
available for targeted runs, not a repeated whole-device matrix. No real earned
multiplayer campaign or actual physical-phone check claimed.

Still required1.8: persistent guild events, readiness/moderation improvements,
physical casino seating/table presence/session-reconnect/camera-input foundation.
Runtime remains1.7 until1.8 packaging.

Releaseupdate:1.6cf2a028d correction pushed; CI34739522914 RUNNING. Prior1.6
34c1c0d8 verified BOTH live endpoints, database ready, but finalCI34738051311
failed regional/ Verdant legacy reset helpers that did not confirm the new
desktop dialog. New correction gives desktop the same confirm/cancel IDs as
phone and explicitly confirms resets in regional/common/party QA routes;
5focused preparation/reset tests PASS1.614s. Do not bypass final gate. Original
1.7 candidate has merged the correction and waits for verified1.6 completion.

Full games/location/town relocation are1.9; both functioning floors and final
integration are1.10. The VIP currency remains an unresolved user decision:
never name it, substitute Gold/Resonance, or count an inaccessible placeholder
as completion. Read the existing casino roadmap and economy boundary before
implementing its sessions. Obtain that currency decision before VIP integration.

Use focused changed-path checks and essential authority/save/currency safeguards,
plus build/release smoke. Consolidated earned group/device/endurance checks stay
in final stabilization, not repeated for every batch. No new soak started here.

Initial inspection: party response accepts an inviter name without checking an
outstanding invitation. Fix server-owned expiring one-use invitations tied to
the original party before extending group recruitment. Existing accept/decline,
busy and block controls should remain the player-facing flow.

04:51 invitation batch implemented: World owns one outstanding invitation per
target, expiring at60seconds and bound to the original party object as well as
leader/target IDs. Accept/decline consumes it; expiry, replacement/disband,
leadership changes, offline/busy targets and full/already-joined parties reject.
Validation+join are atomic under World.Mu, including concurrent last-seat claims.
Existing wire/UI accept flow remains; the modal explains expiration. Handlers
recheck mutual block filtering, use detached inviter/locked party snapshots,
and withdraw an invitation when delivery fails rather than falsely confirming it.

Focused invitation authority tests PASS0.025s, existing handler busy/delivery
tests PASS0.585s, existing gameparty/invite selection PASS2.498s; changedJS lint,
Go build-trimpath-all and diff checks PASS. No multiplayer campaign or broad
matrix run. Still required: actual finder/recruitment UI and authority, guild
event scheduling, readiness/moderation improvements and casino seat/session/view
infrastructure. This invitation batch is not1.8completion.

Publishing: frozen1.7f3adf398 still unpublished while corrected1.6CI34738051311
runs (server/client/browser2/browser3PASS, browser1running at04:50). Keep ordered
publication and verify each exact live identity before pushing the next milestone.
