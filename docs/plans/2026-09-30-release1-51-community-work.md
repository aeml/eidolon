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

## Evidence

Two friend-handler regressions failed against a new loopback-only disposable
MongoDB in1.285s: false incoming sender notification, missing sender list and
missing decline refresh. After the fix, all17 selected friend/structured-chat
checks ran with the real disposable database in1.107s, then race detection
passed in3.873s. The container and its disposable data were removed; no
production database/account was touched. Additional closed-destination
assertions for `/party` and `/guild` passed in the six structured-chat checks
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

## Remaining milestone checks

Continue the presence/reconnect and invitation identity audit, including delayed
disconnect notifications versus replacement sessions and nonexistent friend
targets. Confirm current friend status and contact actions are understandable
without relying on developer commands. Retain prior report/ignore permissions
and group-channel visibility evidence; add only coverage for changed behavior.
This work does not certify guild operations (1.52), recruitment (1.53), final
modern art, actual-phone performance, campaign pacing or beta capacity.
