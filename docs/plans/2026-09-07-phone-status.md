# Phone status effects — work toward Alpha 1.0.33

Separate checkout `/tmp/eidolon-phone-status-4tL5fL`, branch `work/phone-status`,
based on locally verified 1.0.32 `95de5ce`. Candidate changes have separate
1.0.33 patch notes and aligned version metadata; not published or a completed
phone-playability gate. Final regression/integration evidence is recorded below.

The prior real-duration captures exposed small hover-only buff icons on phones.
The new phone-only Effects entry opens a non-modal reading panel with names,
buff/debuff labels, remaining seconds and complete descriptions. Close and Escape
restore focus; chat/menu interaction closes the panel without dismissing chat.
Rows update by identity without rebuilding focused/scrolled content. Expiry removes
the row and leaves an explicit empty state. Character changes and UI recreation
clear stale state/listeners. Desktop buff icons/tooltips remain the existing path.

Focused component/minimap checks pass **24 tests**, and lint passes. Four browser
fixtures exercise 30 effects at 360×800, 390×844, 844×390 and 568×320, including
native touch scrolling, 16px descriptions, reachable Close, chat/Escape, expiry,
and unobstructed joystick/Attack/hotbar/chat hit targets. The initial fixture
forgot to initialize InputManager's mobile controls and failed all four; after
correct initialization, three passed and 568×320 exposed the old 88px minimap
overlapping Attack. A compact 56px minimap and top alignment only on landscape
screens at most 360px tall remove that overlap without shrinking combat controls.

Final layout repeat **passed 4/4 in 13.6 seconds**, session `45028` closed, log
`/tmp/eidolon-1-0-33-layout-short-screen.log`. The failed fixture/overlap runs are
retained in `/tmp/eidolon-1-0-33-layout-{browser,controls}.log`. Final portrait and
short-landscape captures were visually inspected. These are UI fixtures without
actual world combat, not physical-phone or live-server playability proof.

The inherited real-duration route now opens the phone panel and verifies effect
name, description, Buff label and countdown against authoritative snapshots.
Its first run failed after baseline display because the added Fireball check
tapped hotbar slot 1 (Teleport on branch C) instead of the dedicated Skill button.
No runtime change was needed for that failure. Log
`/tmp/eidolon-1-0-33-status-gameplay.log`, session `77155`, closed with failure.

With the correct normal Skill input, session `67853` passed in **38.2 seconds**
(37.1-second body), log `/tmp/eidolon-1-0-33-status-gameplay-skill.log`.
Observed baseline duration **19.974 seconds**, trained **24.982 seconds**, and
saved landscape cast **24.982 seconds**. The trained shield survives the old
20-second deadline, then authoritative expiry clears absorption, attached visual
and the panel row while the open panel shows its empty state. Accepted Fireball
casts work while reading; opening chat dismisses the panel and exposes its input.
The route uses a disposable level/readiness fixture, ordinary talent purchases
and touch casts, not earned progression or a full combat/physical-device pass.
Credential scans and isolated container/data cleanup passed.

The new four-viewport layout route is included in normal anonymous smoke. After
version alignment, **179 client suites / 2,508 tests passed in 84.716 seconds**
(session `21683`, `/tmp/eidolon-1-0-33-status-final-client.log`); lint, shell
syntax and diff checks passed. Full anonymous smoke **passed 39/39 in 3.5 minutes**
(session `22429`, `/tmp/eidolon-1-0-33-status-anonymous.log`), including all four
status layouts and existing phone/menu/camera/inventory/quest checks. No server gameplay
code changed; the inherited 1.0.32 paired tests and full race repeat are recorded
in [duration evidence](2026-09-07-talent-duration.md), including its retained
Tripwire failure. The real-server route above builds and exercises that backend.

Keep the 1.0.28–1.0.32 ordered release queue intact. Integrate the main hunt-evidence
and QA commits before release; this checkout's base predates those main-only
changes. Physical iOS/Android keyboards and sustained play, camera composition,
party-target healing and the remaining town menus are still open gates.
