# Alpha 1.51 community work

Local work in progress, not a deployed release or a completed community audit.
Publish only after ordered 1.49 and 1.50 acceptance, remaining 1.51 work, version
packaging and its own normal CI/public checks. Current runtime metadata is1.50.

## Confirmed fixes

- Outgoing friend-request success no longer sends an incoming-request packet
  back to the sender. It refreshes the sender's authoritative list; only the
  recipient receives the pending-request notification.
- Successful decline now refreshes the recipient's authoritative pending list,
  removing the card and badge without optimistic client-side acceptance.
- Party/Guild/Whispers tabs are also composition destinations. Plain text uses
  existing `/party`, `/guild` or `/r` commands; focusing via the game's Enter
  path preserves the destination. Explicit slash commands remain unchanged.
  Server rejection cannot silently deliver private/group text to the world.
  Placeholder/accessibility labels explain the current destination. Escape
  deliberately returns to All while leaving chat available.
- Opening Social also refreshes the persisted friend list, reconciling offline
  requests, blocks/removals and reconnect state rather than relying only on the
  initial login snapshot. No relationship permissions or chat visibility rules
  are relaxed.
- Requests now check that the target account exists before saving a pending
  relationship. Valid offline accounts still receive persistent requests, and
  surrounding whitespace is trimmed.
- Login/logout notifications now read current session ownership while serialized
  with character handoff, rather than trusting a delayed event's old state.
  A replacement connection stays online; an already-disconnected account stays
  offline. Online notifications include current social status, and broadcasts
  update the status shown in an already-open Friends tab.
- Friends have Invite and Whisper buttons, disabled when offline. Whisper opens
  the private composer with a named recipient that remains selected even if an
  unrelated player whispers meanwhile. Switching to All still sends publicly;
  explicit commands retain their existing behavior. Existing invitation
  permissions and block/ignore consent checks remain authoritative.

## Evidence

Two friend-handler regressions failed against a new loopback-only disposable
MongoDB in1.285s: false incoming sender notification, missing sender list and
missing decline refresh. After the fix, all17 selected friend/structured-chat
checks ran with the real disposable database in1.107s, then race detection
passed in3.873s. The container and its disposable data were removed; no
production database/account was touched. Additional closed-destination
assertions for `/party` and `/guild` passed in the structured-chat subset
(0.360s), proving rejected sends produce no fallback chat.

Three channel-focus cases independently failed before the client fix in0.825s.
After fixes, five impacted JS suites passed84checks in2.593s, including saved
relationship refresh, request/presence UI, safety/report actions and bindings.
Scoped lint and whitespace checks are clean.

Two real-UI browser cases passed16.7s at1280×844 and390×844. They exercise
tab selection, the public focus path, plain group/private composition, explicit
whispers, Escape/All and permanent chat through shipped UIManager/ChatUI/styles.
Artifacts: `/tmp/eidolon-1-51-community-chat-0930`. The phone screenshot confirms
readable channel labels/transcript and reachable composer. These use prepared
callbacks, not authenticated players or phone hardware. Mandatory browser
discovery includes all240cases exactly once, without omission/duplication.

## Additional presence and contact validation

The nonexistent-account and delayed-logout cases independently failed against
a second disposable MongoDB before their fixes (1.158s). With the corrections,
the selected friend/chat checks passed; the expanded set including valid offline
requests passed race detection in6.927s. The database was bound only to loopback
and removed afterward, including its temporary data. No production account or
save changed.

Five impacted JS suites now pass89checks in3.278s. The expanded desktop and
phone-sized browser cases pass20.4s and cover reachable Invite/Whisper buttons,
disabled offline contact, closing the overlay, focusing a named private
composer and retaining that target after another incoming whisper. Reviewed
phone screenshot: `/tmp/eidolon-1-51-community-contact-final-0930`, including
`friends-contact.png` and `community-chat.png`. These remain real shipped UI
with prepared callbacks, not authenticated multiplayer or physical-phone proof.
Scoped lint and whitespace checks remain clean.

Existing party/chat handler checks plus four new directional block/ignore
cases pass race detection in4.378s. Both party invitations and friend requests
are rejected before creating a party or reaching persistence, with no packet
to the restricted recipient. Previously covered world/party/whisper routing,
replay visibility and no-public-fallback behavior remain intact. Existing
SocialSafetyUI tests cover report drafts and ignore/block controls; no report
permission or automatic moderation behavior changed.

## Remaining milestone checks

Presence ownership, nonexistent targets, normal friend contact controls and
contact consent now have scoped evidence. Package1.51 with cumulative patch
notes after ordered1.49/1.50 acceptance. Its own CI and public deployment checks
are still required; no local result substitutes for that gate.
This work does not certify guild operations (1.52), recruitment (1.53), final
modern art, actual-phone performance, campaign pacing or beta capacity.
