# Direct quest map guidance

Qualified source: `256b35bd59ae1eeb95ad3e771548296cced15829`, based on selected
entry/Lore/owner-audit source `91f4a3184247b6d4c8a5314d0d85deb6bbbb801b`.
This is component qualification, not deployment or full-game acceptance.

The current Chronicle task, accepted daily cards, accepted optional catch-up
rows and Lore Book current task offer **Show quest on map**. A deliberate
request temporarily reveals its nearest eligible unread site, search area,
admission point or manual turn-in. **Return to map** restores the previous raw
search, filters, selection and viewport; closing also clears temporary focus.
Ordinary map opening still centers the player. Existing per-character pins,
waypoints, quest receipts, rewards and movement remain unchanged. Progress can
advance the selected unread site to remaining work and then manual turn-in.
Future unaccepted chapters and unavailable targets remain hidden; a quest with
no mapped target gives an honest local message and opens the surroundings.
Instance transitions clear temporary context without restoring another world's
viewport. Dark Realm explicit requests use that same personal-quest projection.

The Player Guide gains two matching sentences. Its other Help bytes remain
exact: updated Help SHA-256
`60383855f5f4d810dacfae3f61ca0d32bc5ce0343075633606dc2fd0cf56d304`.

All158 focused CPU cases/eight suites and changed-JavaScript lint pass. Eighteen
new client cases cover explicit untracked selection, future/completed exclusion,
nearest sites, progress/turn-in, return state, detail focus, typing/caret, other
destinations, instance transitions and the visible journal/Lore control bindings.
The Dark Realm regression fails before the missing quest-ID forwarding is fixed.

Two new desktop1280/touch390 browser cases pass with actual UIManager, WorldMap,
InputManager, keyboard Enter, touch controls and disposal. Prepared personal
snapshots exercise the overworld, optional Keeper's House and Dark Realm manual
turn-in. Six existing Atlas/Lore cases also pass on current source in a separate
final run, including the instance transition and returning/finale context. Eight
distinct passing cases are counted once. Browser evidence uses System Chrome
with GPU disabled for DOM/Canvas2D; it does not establish earned progression,
3D/native frame time, physical-phone usability or final owner approval. Current
phone optional/turn-in and desktop map captures were visually inspected.

Nine parent packets retain original regressions, observer/fixture corrections,
intermediate passing overworld proof and the final Dark Realm hidden-control
selector failure. In that last observer failure, `.first()` chose a hidden Lore
Book duplicate; scoping to the visible Story section repairs the test. No timeout,
progress guard, runtime requirement or quality limit was relaxed. Six existing
cases were rechecked because the instance branch changed; the final two new
cases were rechecked after correcting their visible-control selector.

Private evidence:
`/home/aeml/.local/share/eidolon-quest-map-review-20261017/.qa-quest-map`.
Frozen68-file inventory SHA-256:
`6741fc2f43efefe150d050733386595ebf7f7491365a829b908f3b0ee082f814`.
Expected merged client total:802suites/12452cases; engine513modules. Two new
anonymous browser cases are added. Actual release CI remains required.

Full original game/world/art/combat/audio/performance/device/security/operations/
owner/F1-F5/beta/1.99 scope remains active. Soak/stress and human campaign/physical
phone feedback remain deferred, not passed. No feature-freeze or beta declaration.
