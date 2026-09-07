# Phone encounter space: readable objectives and finite notices

Local follow-up to Spirit checkpoint `b8a761e`; not yet published. This advances
the shared phone layout, not physical-device sign-off or the complete 1.1 gate.

## Evidence and changes

The Spirit gameplay captures at 390×844 show a multi-line level-100 notice still
covering the world long after the level event. `showCombatCallout` used `duration`
only as display copy: it had no expiration. The same screenshot shows a quest
tracker spending a second 44px row on a Journal button below its objective.

New unit tests reproduce **10 failures / 11 passes in 2.361s** before repair,
`/tmp/eidolon-phone-composition-before.log`. Notices now expire after their
specified positive finite duration (four-second fallback), restore an existing
selected target, and cancel superseded timers. Selecting/clearing a target cannot
leave stale warning styling or let an old timeout erase/resurrect another target.

The phone objective itself becomes a two-line, 16px-text journal button. Its full
title and progress remain in the accessible name and journal. A separate 44px
Next button cycles every tracked objective without altering saved selections.
Non-quest town/dungeon guidance remains visible instead of inheriting the old
hidden `.objective-guidance` card. The tracker occupies one 52px row; in landscape
it shares the top status/navigation strip. Desktop tracker behavior is unchanged.

Level-up guidance now names the actual 30/60/70 dungeon unlocks, and a jump to
100 correctly announces Heroic/Mythic rather than hitting the level-30 branch
first. Ordinary phone guidance refers to Menu → Skills & Runes, not keyboard K.

Focused checks pass **73 tests / 3 suites in 1.912s**. The first full client pass
is **195 suites / 2,889 tests in 136.708s**. The first six layout checks pass in
**1.3 minutes**, but screenshot review catches landscape health-bar overlap and
an inherited eight-pixel list margin clipping the row. Those issues are corrected
and explicit full-button bounds/health-overlap checks added, including 568×320.
That first green layout result is not final acceptance. Final corrected evidence
is recorded below and in the [1.0.38 candidate](2026-09-07-release38-encounter-space.md).

The expanded short-landscape route subsequently fails because the Journal's
desktop minimum height pushes it over chat at 568×320 (bottom 308px versus chat
264px), `/tmp/eidolon-phone-composition-layout-final.log`. Phone quest windows now
reset that minimum and retain internal scrolling. This is a real additional defect,
not a flaky retry; the next run verifies the changed CSS with the same assertions.

Tracing the oversized green “Guardians” line in gameplay also identifies a local
replicated support notice, not a cherub nameplate: it repeats the full local player
name before the action. Phone self-feedback now omits that redundant prefix while
retaining the action, other players' attribution and desktop behavior. General
remote nameplate/text density remains open.

The corrected expanded layout suite passes **7 tests in 1.5 minutes**,
`/tmp/eidolon-phone-composition-layout-verified.log`. Final focused checks pass
**80 tests / 5 suites in 3.216s**. Inspected final 568×320 and 844×390 captures show
the tracker clear of health/mana and its full button bounds inside the row.
The candidate's real-server 390×844 Spirit capture shows the short “GUARDIANS UP”
line, two-line objective and no lingering level-up panel. Actual camera/controls
remain otherwise unchanged; that screenshot is not physical-device sign-off.
Final candidate checks pass **195 suites / 2,892 client tests in 142.066s** and
isolated real-server Spirit/phone/observer gameplay in **1.3 minutes**. All browser
error/credential guards and cleanup pass. The implementation is locally verified,
not yet published.

## Still open

This does not complete the phone composition. Camera framing still uses the
existing navigation/hotbar measurement, rather than a fully shared encounter
region. Party healing/roster composition, crowded nameplates, real combat framing,
actual iOS/Android gestures/keyboard/thermal performance and the full visual/menu
redesign remain open. Layout fixtures and an isolated town cast do not establish
earned dungeon or multiplayer encounter playability.
