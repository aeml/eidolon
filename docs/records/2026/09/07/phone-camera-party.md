# Shared phone encounter composition and deliberate party support

Work after preserved 1.0.38 candidate `add49409a0b6fd845ebd7995aa462731b2a29271`.
Now being packaged separately as Alpha 1.0.39, with its own login version and
patch notes. Not included in 1.0.38 or published. The complete roadmap remains open.

## Findings and implementation

The previous projection measured only `mobile-top-right` and `hotbar-container`.
It did not share the layout's objective, minimap or action-button reservations,
and it never shifted horizontally around landscape thumb controls. New unit
checks reproduce two wrong-center failures in **0.798s**. Before captures and
three failed region-contract fixtures are retained under
`/tmp/eidolon-encounter-before-Nc3iLy/test-results`; the browser fails because
there is no shared region, not because a missing DOM node alone proves poor play.

The new layout-owned `phone-encounter-region` reserves encounter space. The camera
reads that region on viewport/layout changes, including a ResizeObserver, and
keeps the established 24-world-unit short-axis scale at default zoom. It offsets
both axes without shrinking actors or clipping the world canvas. Menus, chat and
callouts do not resize the reservation. Observer and viewport-listener cleanup is
explicit. The exact raycast back to the hero's ground position is checked.

Landscape puts the four skills into a right-thumb 2×2 block with the primary
actions above it. The full map remains available through Menu; the cramped
landscape radar is removed and Effects moves below the health bars. The first
camera/HUD/status/solo-composition suite passes **10 checks in 1.1 minutes**, with
inspected 390×844 and 568×320 production-model fixtures. Those fixtures establish
layout/readability, not actual encounters or physical-device performance.

The always-open party roster would still obstruct the hero. A phone-specific
Party button uses the duplicate desktop ability-icon slot; Skill and Skills &
Runes retain the primary ability's action and description. A tap opens a readable
scrolling party panel. Membership/HP updates preserve keyed buttons and reading
position rather than replacing touch targets. Leave, invitation, readiness, loot,
promotion and removal remain deliberate actions with server-owned results.

An explicit ally selection drives Healing Light and Divine Intervention only;
damaging skills retain their separate enemy selection. Missing, dead, departed
or hostile selected allies block the cast instead of silently redirecting a heal
to the caster. No selection means self. Range still requires deliberate movement,
not automatic pursuit. A two-real-account cast route is being added to prove this
support interaction before the roster redesign is accepted.

## Verification in progress

- Camera unit checks pass **13 tests in 0.748s**.
- Party/target/legacy combat/social/camera checks pass **77 tests in 3.864s**.
  The initial new cast fixtures passed the skill as the target-vector argument;
  they are corrected to use the actual `(targetVector, skillName)` interface.
  Their initial nine failures are fixture errors, not before-fix evidence.
- The populated-HUD run initially passed eight checks but timed out in both
  landscapes: the later quest tracker intercepted expanded chat's collapse
  button. Retained log `/tmp/eidolon-encounter-party-browser.log` (6.1 minutes).
  Expanded chat now sits above ordinary windows/HUD and below modal dialogs.
  A direct hit-target assertion and bounded action timeout retain this regression.
  All **10 checks pass in 2.0 minutes** after repair, including 568×320;
  `/tmp/eidolon-encounter-party-layer-fixed.log`. Inspected short-landscape world
  and party captures show separated controls and readable scrolling rows.
- Actual constructor observer registration, changed-region projection, stable
  zoom and disposal of both observer and viewport listener are tested. The first
  lifecycle fixture accidentally kept the same region center, so its expected
  matrix change failed; this was corrected to change the center. Camera/party/
  support checks then pass **31 tests in 2.779s**;
  `/tmp/eidolon-party-camera-lifecycle-unit-fixed.log`.
- The first real two-account Healing Light route passes **26.6s**; the extended
  route passes **25.5s**, checking both Healing Light and Divine Intervention in
  390×844, 844×390 and 568×320. Each uses deliberate touch selection, normal
  hotbar casts, authoritative heal messages addressed to the actual ally,
  increased ally HP and unchanged caster HP. Joining and leaving are normal UI
  actions; departure clears the selection. Browser guards, credential scans and
  exact disposable-service cleanup pass. Logs:
  `/tmp/eidolon-phone-party-real-cast.log` and
  `/tmp/eidolon-phone-party-both-casts.log`. Prepared level/health/cooldowns are
  explicit isolated QA conditions, not earned progression or combat-pressure proof.
- The unversioned full client pass completes **197 suites / 2,914 tests in
  129.225s**; `/tmp/eidolon-phone-party-full-client.log`. Lint passes.
- Reviewing the real support screenshot reveals the old desktop combo popup
  covering short-landscape combat space. Phone combo notices now occupy the lower
  reserved encounter edge, keep 16px names and never intercept touches. A rendered
  check measures its bounds, actor separation and expiry. This subsequent change
  and the final 1.0.39 packaging are undergoing fresh verification; the preceding
  full-client and party passes are not claims about those later changes.

Physical-phone default-view sessions, real group/dungeon pressure, touch keyboard
and interruption handling, wider class/skill parity and 1.1–1.10 remain open.
