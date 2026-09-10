# Standalone safe-zone combat feedback — release preparation

September 9. Local preparation based on release59 candidate e236b37; not pushed,
versioned as a successor, deployed or accepted. Release59 must finish its own
predeploy, deployment, native live QA and exact public identity verification
before any successor is pushed. Keep its canonical worktree unchanged.

## Player-facing correction

The target card currently says "In Range" while the server prevents PvE damage
from inside a sanctuary. Use the server-replicated safe-zone membership to show
"Leave the safe zone" instead, and restore the normal range status on departure.
Do not infer protection from client coordinates. Valid player duel targets retain
their existing feedback. This does not change protection, casting, mana costs,
healing, Well Rested, reward rates or progression.

Port only the engine/UI correction and direct regression evidence from primary
28057a5. The expanded story, earned-route helpers and their changed prerequisites
are deliberately not dependencies of this presentation correction. The new Go
test checks the real observed town-edge coordinates, fence boundary, normal
departure, dungeon scene isolation and both PvE directions against authority.

Draft player patch note for the eventual successor: "The combat target card now
explains when you must leave a safe zone to attack an enemy, instead of showing
an apparently usable in-range attack."

## Remaining release gates

- [x] Full client/lint and server regression on this exact candidate.
- [x] Actual desktop/phone card rendering with inspected retained screenshots.
- [x] Native membership departure feedback and preserved town recovery behavior.
- [ ] Finished release59 acceptance before selecting and synchronizing successor
  version, login text, release identity, build defaults and actual patch notes.
- [ ] Normal canonical push, all CI/predeploy/deploy/live checks and fresh public
  login/runtime/backend identity. No claim of live delivery before those pass.

The ongoing primary fresh-character replay is separate earned gameplay evidence.
Its full campaign, class/group balancing and physical-device gates remain open.

Local focused session60020 passed both engine/UI suites (12 tests, 1.451s) and
lint on Node24.18.0. This is not browser rendering or full release acceptance.

Extended the existing native well-rested journey, rather than adding a duplicate
login/combat route: ordinary movement stops just inside the east boundary, a real
mouse hover must show the warning using replicated membership, and the same enemy
must regain normal range feedback after ordinary departure. Retains all original
earned combat, depleted-pool healing, aura, bank and reconnect assertions. Added
screenshots for both boundary states. No game-state assignment or QA teleport.
Focused59653 PASS28tests/4suites1.574s+lint, including existing local/live gate
wiring. Actual journey evidence follows; full release gates still remain open.

## Local rendering and native proof on95e3f28

62768 passed both desktop1280x720 and phone390x844 card cases in6.5s, using the
real engine/controller/UI and default render styles. Both warning screenshots
were inspected and retained at `/tmp/eidolon-safe-release-card-proof-N7eOTh`;
scanner0, web41961 absent after terminal. Log `/tmp/eidolon-safe-release-card-2343.log`.

25868 passed the extended native journey in35.9s (test34.6s). No preparation or
progression grants: fresh level1Wizard hovered Skeleton-lanternhold-1 at real
x94.985/z200.010 inside town, then atx119.929/z199.969 outside. Replicated membership
and the same target card changed from the sanctuary warning to normal range.
Both complete-world screenshots inspected. The ordinary subsequent Fireball was
accepted, MP110→80, and actual outgoing damage receipts arrived; incoming enemy
damage was observed separately. Recall restored HP106→110 and MP80→93→110, with
the earned bank17.624→17.998 and attached aura surviving fresh login.

Native archive `/tmp/eidolon-safe-release-native-proof-py0yzm`, scanner0;
log `/tmp/eidolon-safe-card-native-2344.log`. Exact disposable containers and
API18560/Mongo18561/web41960 absent after terminal cleanup. This is local native
proof, not production delivery, full-server regression or physical-phone sign-off.

Full11025 on63343d2 completed September10,00:02UTC: client253suites3598tests
81.541s+lint, server-race all packages passed (root14.220s/game235.846s/database
1.116s/lifecycle1.032s). Logs `/tmp/eidolon-safe-release-full-{client,lint,server}.log`.
Release59 is now deployed with matching public identity, but its final native live
QA remains active. No successor identity, version bump, publication or final
acceptance is implied by this local regression pass.
