# Desktop gameplay/HUD review and combat dock

Local candidate followingf8083c90. Prior goal turn was progress: woodland
canopy/floor integration. No deployment, identity change or milestone acceptance.

## Real client evidence

Added an explicit disposable desktop-presentation route to the existing isolated
QA wrapper. Fresh Fighter,1440x900, production camera/HUD, opt-in raised terrain.
Captured town, an encounter reached by the existing QA waypoint, and an actual
mouse basic attack with a matching outbound target and replicated health loss.
Waypoint protection is active: this is NOT survival, earned progression or
class balance evidence. No encounter state or health is assigned in the browser.

Recordings are off during authentication. Captures require the login/password
UI hidden, redact the account label, hide chat transcript text and the local
performance overlay, and leave the HUD panels/controls in place. Credential
artifact scans passed. Both disposable service sets were removed.

Baseline desktopview0929a passed16.8s. Review showed widely separated resources
and action controls, an oversized floating primary icon and four empty starter
hotbar slots. Archived baseline:
 /tmp/eidolon-desktop-hud-baseline-0929-vX0HO9

## Implemented interface change

At desktop widths1100px and above, resources and five action indicators share
one compact central dock. HP/MP are labeled with actual numbers, the primary
icon matches the numbered slots and shows its existing RMB binding. No new
input behavior, skill assignment, cooldown timing or gameplay change.

Chat remains permanently available and resizable; its maximum wide-screen
width leaves the dock clear. Menu buttons wrap within the remaining right-hand
space instead of overlapping actions. Level text moves beside the full-width
XP strip. Narrow-screen and phone layouts are untouched. All styling is CSS,
with no per-frame work or bitmap assets. Runtime hide still removes the frame.

## Verification and remaining work

- Desktop layout at1100x700,1280x720,1440x900,1920x1080 verifies alignment,
  resized-chat/menu separation, control hit-testing and tooltip visibility.
- Existing phone party/joystick/control/chat checks also passed. Combined3
  layout tests passed47.3s. No physical-phone or universal accessibility claim.
- Final desktopview0929b real client check passed16.7s; attack capture inspected.
  Final artifact: /tmp/eidolon-desktop-hud-final-0929-bPqFvw.
- Scoped ESLint, shell syntax and whitespace checks pass.
- No full campaign, dungeon or raid soak; unchanged encounter evidence reused.

Resources/actions now read as one group. The actual world still has sparse
terrain, conspicuously procedural actors and large primitive structures.
This does not establish enjoyable full kits, party readability or final
modern-ARPG quality. The UI1.45 work remains partial: menu/tooltip/state/focus
coverage still needs its broader audit. Keep earlier ordered releases and
pending1.39/1.40 decisions open; no gate bypass.
