# Alpha 1.8.0 — find your people

Developed separately from frozen1.7f3adf398. Runtime remains1.7 until packaging.
Preserve ordered1.6→1.7→1.8 publication and live identity verification.

Required: activity group finding, recruitment and role listings; persistent guild
event scheduling; better invitations/readiness; moderation workflows built on
existing block/report/guild authority. Add authoritative physical casino seats,
table presence, session/reconnect handling and camera/input ownership for both
desktop and phones. No remote menu-only casino or pretend multiplayer seats.

## Durable blackjack Gold checkpoint

Added private versioned blackjack table documents and immutable pending Gold
transfers. Intent is durably journal-acknowledged by Mongo before character money
changes; existing full-save and signed receipt paths make retry idempotent.
Pending transfers fence turns; insufficient debit funds keep the old state, while
IO errors retain recovery intent and earned payouts cannot be silently discarded.
Public-floor currency fails closed for VIP/Resonance; no separate wallet added.

Focused actual Mongo CAS/replay/currency checks PASS0.352s; real character+table
reopen/recovery PASS0.278s; interrupted live-save checks PASS1.327s; competing
account spends PASS0.059s. Go build-all/diffPASS. Owned loopback Mongo32918 stopped.
The initial legacy TestApplyGold pattern matched no tests, not a coverage claim.

Not yet wired to seated wagers/round UI or startup/background scheduling. Next
binds the betting/playing/settling lifecycle to these primitives. Exact handoff
and lock ordering: [blackjack rules/integration](2026-09-13-casino-blackjack-rules.md).
1.7CI34742314831 now all client/server/browser jobsPASS; predeploy character QA
RUNNING. Monitor the same job;1.6 remains last verified live. No new soak run.

## Concrete blackjack round engine checkpoint

Added `server/internal/game/casino_blackjack.go` as the first concrete consumer
of shared-round infrastructure. Six-deck secure shuffle, canonical seat turns,
30-second deadlines, hit/stand/double/split, dealer peek/S17, natural3:2 and exact
integer returns are implemented. Immutable proposals report additional stakes
without mutating the original round; detached public views hide the shoe/hole
card. Serialized rounds retain the same shoe/deadline and do not redeal on resume.
Rules and remaining money/network integration are in
[the blackjack handoff](2026-09-13-casino-blackjack-rules.md).

Focused blackjack rules selection PASS0.016s; Go build-all and diff checks PASS.
This is not yet connected to Gold, live table messages, or a playable seated UI.
Do not enable wagers or claim1.8 closure from standalone rules tests. Next is
durable account-serialized stake/settlement integration, then the shared UI.
Required full slots/poker/two-floor/VIP content remains in subsequent stages.

1.7correctede84f6219 CI34742314831: client/serverPASS, three browser shards running.
No deployment success claimed, no job restarted, no broad local soak run.

## Shared preparation checkpoint

Server presence now includes a shared preparation phase per table: waiting for
real players, waiting for a reserved seat to reconnect, preparing, or everyone
ready. Blackjack/slots require one connected player; poker requires two real
players. An opaque roster revision binds ready requests to the actual seats and
connection generation without exposing other players' private session IDs.
Join/leave/reconnect invalidates readiness, including a join/leave between polls;
delayed requests against a previous roster reject and refresh. Client shows the
server phase and sends the viewed revision. No automatic deal, wager or debit.

Focused game casino selection PASS0.081s including solo/multiplayer minimums,
stale consent and reconnect. CasinoController3tests PASS8.652s; changedJS lint,
client preparation, Go build-all and diff checks PASS. The connected test's
ready payload was updated for the revision field; its prior actual socket/restart
evidence predates this protocol addition and has not been rerun. No geometry or
camera changes; reuse the previous rendered seat/phone evidence.

Still required before claiming complete1.8 casino infrastructure: connect shared
membership/preparation to synchronized round lifecycle. Readiness alone is NOT a
played round. Full game content, money settlement and both floors remain later.

## Connected seating checkpoint — September 13, 06:17 UTC

Actual two authenticated sockets now verify exclusive seats, public presence
without private token leakage, rejected cross-player readiness, safe disconnect
save coordinates, real token resume with readiness cleared, and ordinary login
after a server restart. Gold remains unchanged. Focused test PASS in 1.806s
against binary92380189 and the disposable loopback Mongo; the owned Mongo was
then stopped. Evidence: `/tmp/eidolon-compat-session-511798144/server.log` and
`/tmp/eidolon-compat-session-4145311672/server.log`. This is real network/restart
coverage, not a rendered multiplayer game or wager/settlement check.

The first restart exposed the1.7 character reader rejecting its new arena-results
journal directory. Correctione84f6219 was merged as92380189 and the connected
restart now passes. Original1.7 CI34741198072 was cancelled before deployment
for that real blocker. Correctede84f6219 is pushed; replacement CI34742314831 is
running. Production remains verified1.6 until the replacement gate completes.

## Physical casino client checkpoint — seating, not wagering

The former solid Oathhall is replaced in the town generator with a walkable
casino ground floor, a five-unit entrance and five wall segments instead of the
old whole-building collider. An interior cutaway hides tall walls/upper shell
while inside, preserving low wall edges for navigation. Upper-storey exterior
retains a two-floor silhouette; walkable upstairs/stairs and the stash/layout
adjustments remain venue-stage work, not completed VIP content.

Client casino_update routing now draws real tables, machines and individual
pickable chairs from the authoritative catalog. Chair interaction requires entry
into the building and approaches the server-defined exit/use position, then asks
the server to sit. Shared occupants/readiness appear in the table panel. Owner
and remote SEATED actors use existing hip/leg/arm rig pivots; leaving restores
the rig. Server confirmation owns leaving and the safe exit, not an optimistic
client-only menu close. Scene changes do not teleport a player back into town.

Table view smoothly blends camera position/zoom, restores prior camera settings,
blocks normal combat/jump/movement intent, hides thumb combat controls/hotbar
(not chat), and provides explicit Leave/Escape. Three-second presence refresh is
limited to nearby overworld players. Controller/furniture/colliders/listeners and
temporary poses are cleaned on teardown. No remote minigame menu replaces chairs.

Shell geometry is batched by material separately for the cutaway; furniture is
batched while individual non-rendering pick proxies preserve seat interaction.
Existing town draw-call budget remains bounded. Furniture has separate collision
boxes; scene-clear reattachment does not duplicate those colliders.

Focused CasinoController3 + existingWorldGenerator20 initially PASS except the
old town collider count: the Oathhall previously used one oriented collider, so
its replacement adds5 boxes and removes that oriented collider (22 boxes total,
not21). Corrected town geometry/shadow case PASS0.888s; unrelated passed cases not
rerun. Focused SystemChrome casino-seating.spec.js PASS4.3s (6s total): real mesh
chair picking, server-response fixture, two seated class models, 390px panel/44px
Leave and exit restoration. Screenshot inspected at
`/tmp/eidolon-casino-seat-view-20260913.png`. This is a controlled rendering fixture,
NOT a live two-client server session, actual phone test, game round or wager test.
ChangedJS lint, prepare-client and diff checks PASS.

Still required for1.8 closure: verify the actual connected seating/resume path
and complete table membership/round-state integration without claiming that
readiness constitutes a played game. Full games/payouts/VIP remain the subsequent
casino stages. Do not publish this as a completed functional casino.

Releasequeue:1.6cf2a028d completed CI34739522914 SUCCESS, exact frontend/backend
identity rechecked and database ready. Frozen1.7 HEAD5fd16d751cbdb50cac576bf02e86cec64111875b
PUSHED master; CI34741198072 confirmed running (clientPASS/serverRUNNING).

## Casino seat authority checkpoint — previous server-only stage

Server foundation implemented: canonical public-table/seat/approach coordinates
inside the current town-hall footprint, server-only seat transforms, one private
session token per seated character and exclusive seat acquisition under World.Mu.
Ownership lives on the entity, not a competing table reservation map. Public
presence includes real names, seat, connected/readiness state; private session
tokens go only to their owner. Blackjack minimum1, poker minimum2 real players;
three elemental machine positions. These are seat definitions, not game rules,
synchronized card/slot rounds or implemented content variants.

Must physically approach in the correct scene, alive/available/not trading.
Movement/jump/attack/casts and direct-trade entry reject seated actors. Sit/leave
change movement context to reject delayed departed inputs. Leave uses a canonical
exit position. Disconnect resets readiness and reserves the seat60s; resume keeps
the session before expiry, otherwise releases it. Scene resets/entity removal
release ownership; unexpected new-scene cleanup cannot teleport a player back.
Arena entry snapshots the chair's exit, not its seated coordinate. Character saves
project the exit while preserving actual resources/rest, so restart cannot strand
a character in a chair. No wagering, settlement, VIP currency or money movement.

Character-only casino protocol is bounded/rate-limited; actions bind to the caller
and seat token. Presence is sent on login/resume and successful seat actions; get
supports the later seated-client refresh. The browser does not consume it yet.
No1.8 publication until the real visual/input/session path is implemented.

Focused seat ownership/private-session/range/combat/reconnect/scene checks PASS
0.012s; actual save-projection check PASS0.011s. Client scene/pose/camera/UI,
table membership-to-round integration and final targeted rendered interaction
remain required. Current building is still solid old geometry; coordinates are
not proof that players can enter it. Build the reachable venue/interactions before
claiming this milestone complete, carrying venue art/game depth into1.9 as planned.

## Player-safety checkpoint

Online-player rows, recruitment posts/applicants and guild rosters now expose
contextual Player safety actions. Block/ignore require an explicit second click
and use the existing persisted slash-command relationship handlers. A shared
Safety disclosure explains their limits and provides unblock/unignore by name.
No optimistic success claim: existing server chat confirms the operation.

Report player opens the existing report form with the player and listing/guild
context prefilled; it preserves an unfinished draft and still requires explicit
submission. Player Report is a supported category in the existing durable report
queue. These are player allegations for review, not automatic sanctions or trusted
server evidence. No parallel moderation service or account-wide punishment added.

Focused social/group/guild/binding UI55 tests PASS2.518s; final safety binding5
PASS0.882s verifies command-injection rejection, retained draft and no report
submission before consent. Existing/new report validation PASS0.010s; build/lint
PASS. The former unsupported-type fixture now uses an actually unsupported type;
Player Report has its own acceptance assertion. Physical casino infrastructure
remains the substantive unfinished1.8 feature batch.

## Guild calendar checkpoint

Implemented saved guild events through the existing guild document, membership
permissions, guild mutex and version-checked writes. Leaders/officers can schedule,
edit and explicitly cancel; members sign up as tank/healer/damage/flexible with
Going/Tentative status or withdraw only themselves. Concurrent confirmed sign-ups
cannot exceed capacity. Rescheduling makes existing commitments tentative and
old-calendar sign-ups are rejected until the player reviews the new revision.
Calendar is bounded to20 events,2–100 sign-ups per event,30–360 minutes and starts
within90 days. Completed/cancelled history expires from views after seven days;
leaving/kicked members lose sign-ups. Server validates the canonical activity;
none of this bypasses dungeon/raid entry rules or automatically forms a party.

Guild window includes a persistent draft editor, local-time dates converted to
UTC for storage, save feedback, collapsible sign-up rosters, online/class context,
explicit normal party invitations and current-party ready checks. Guild updates
preserve drafts. Text remains plain, controls44px, forms wrap on narrow screens.
No physical-device or earned multiplayer campaign claim for this batch.

Schema11 marker prevents older full-guild replacement writers from silently
discarding the calendar. No backfill is required. Do not roll production back to
a schema10 binary after this migration or delete the compatibility marker; use a
compatible forward fix. Production has not been migrated by local calendar QA.

Focused DB checks including isolated Mongo persistence/concurrent capacity PASS
0.057s (owned loopback container, unique records cleaned by tests). Existing guild
management writes preserve the new calendar. GuildUI/GuildEventsUI/UIBindings
12 tests PASS1.256s; final changed calendar UI3 PASS1.267s. Go build, changed JS
lint, prepare-client and diff checks PASS. Initial title-control validation failed
because trimming hid a trailing newline; corrected to reject controls before trim.
No broad suite or soak added. Runtime remains1.7 pending full1.8 packaging.

Still required: remaining readiness/moderation improvements and physical casino
seating/presence/session-reconnect/camera-input foundation. Guild calendar does
not close the milestone on its own.

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
