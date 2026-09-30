# Alpha1.47 — phone session quality candidate

Ordered candidate on prepared1.46, not deployed. Actual phone dungeon/party
and native-keyboard feedback remain owner playtest work; this is not device
certification, a phone FPS claim or closure of the integrated Q gate.

## Shipped changes

- A shared touch release/cancel can include both the skill and movement
  fingers. Skill capture no longer starves the joystick owner of that event.
  It still prevents world taps, preserves each finger's ownership and blocks
  compatibility-click double casts. Non-cancellable browser cancellations
  are handled without attempting prohibited default prevention.
- Blur, hidden pages, page exit, mobile rotation/resize and editor focus clear
  held controls. Opening a phone panel clears pending aim and local pursuit.
  Connection changes clear held input and disconnected/recovering sessions
  discard pending intent, rather than replaying it on reconnect. No reconnect
  protocol, persistence, expiry or transaction behavior is changed.
- Pending skill aims cannot commit through open managed windows, typing or
  a disconnected/resuming session. Existing range/elevation clamping,
  ally-targeted support taps and deliberate fresh inputs remain.
- A session-owned visual-viewport observer fits open panels above a native
  keyboard report, retaining horizontal centering and safe-area padding.
  Thumb controls yield while editing; chat remains available while focused.
  Closing the keyboard restores normal layout. Browser zoom is not detected
  as a keyboard; world rendering/camera framing are not resized to imitate one.
  viewport-fit=cover enables the existing safe-area rules. All new observers
  and input listeners are removed on session teardown.

## Evidence and scope

The first focused test reproduced stuck movement for shared release and cancel
events. The fix passes the same assertions, including non-cancellable cancel.
The first browser run passed gestures but exposed console warnings from
preventDefault on a non-cancellable cancellation; corrected the production
handlers rather than suppressing failures.

Three System Chrome cases pass15.1s: twelve two-thumb cycles at390x844 and
844x390, cancellation without casting, rotation/page-exit/menu interruption,
fresh-input recovery, and keyboard-sized visual viewport with blur restoration.
This uses browser-generated CDP touches and shipped input/menu/CSS, but a
prepared scene and ability fixture, not an earned combat encounter or Android.
Headless Chrome lacks the native phone OS keyboard: the keyboard case injects
its viewport report, explicitly not a real-device result.

Screenshot inspection found a horizontally clipped keyboard panel despite
the original vertical assertions passing. Fixed centering and added left/right
bounds assertions. Final captures were reviewed in
/tmp/eidolon-1-47-phone-session-final-0930: landscape touch hint/control routing
and keyboard-visible search/close/filters are contained in the phone width.

The new browser file runs exactly once in the existing required interface CI
stage, not a new expensive browser job. No longer raid/dungeon/campaign run,
granted character power or test retry/skip policy change was introduced.
Bag/quest/skill and reconnect regressions, version/history and relevant unit
integration are recorded below after terminal completion.

Final integration:9 focused suites465checks pass7.103s, including current
version/history, touch ownership, disposable viewport listeners, menu opening,
required browser-stage ownership, ally/enemy targeting and session recovery.
The twelve existing phone bag/journal/skills and failed-resume cases pass1.4m
across360/390 portrait and844/568 landscape, including blocked storage. These
are shipped-UI browser regressions, not campaign or actual-device results.
Evidence:/tmp/eidolon-1-47-phone-panels-0930. Full lint and whitespace checks
pass; runtime/login/build versions and cumulative notes are synchronized1.47.

## Remaining acceptance

Real-device combat readability, native keyboard/OS interruption quirks,
sustained battery/thermal behavior and party/dungeon ergonomics remain human
playtest-owned. No supported-device restriction is introduced without owner
approval. Final models/modern-art review, High scene budgets, resource lifetime
and integrated transitions remain1.48–1.50 and later roadmap work.
