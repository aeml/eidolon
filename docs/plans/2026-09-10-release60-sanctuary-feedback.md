# Alpha 1.0.60 — sanctuary targeting feedback

Local candidate, not pushed or deployed. Parent59/e236b37 was fully accepted
September10 after every CI/live gate and fresh public identity verification.
Canonical branch `release/60-sanctuary-combat-feedback` uses the existing
`/tmp/eidolon-safe-zone-release-preview-gCLEaT` worktree. Never push root.

This release carries only the already-tested sanctuary targeting warning and its
regressions. It does not change protection, casting, costs, damage, town recovery,
Well Rested, quest progression, rewards or drops. No expanded campaign, primary
test-driver changes, CI cost prototype, aura instancing or casino runtime.

Login/package/lock/manifest/server/container/deploy/isolated-QA/CI defaults and the
alpha roadmap now identify60. Patch notes explain the warning, departure feedback,
preserved duel behavior and unchanged mechanics; all older entries remain.

[Standalone implementation and native proof](2026-09-09-safe-zone-release-preview.md)
records the exact engine/UI, desktop/phone and real-server boundary/recovery tests.
Full regression passed before versioning on63343d2. Repeat checks on the final
versioned candidate before publication; the first version-focused check exposed
one stale package-version assertion, corrected without removing that check.

- [x] Parent59 fully accepted before successor version/publication work.
- [x] Full client/lint and server-race regression on the versioned candidate.
- [x] Final interface and native smoke on the versioned candidate, retained evidence.
- [ ] Review exact diff against59, then normal canonical push.
- [ ] All CI/predeploy/deploy/final live checks and fresh public60 identity.

Full1.1–1.10 completion remains open. This targeted release must not be presented
as completion of campaign, balance, phone ergonomics or the full visual goal.

## Final local evidence on2b30320

Session33981 passed focused254tests, full253suites3599tests75.35s and lint.
Server-race passed every package: root12.655s, game229.897s, database1.094s,
lifecycle1.027s. Logs `/tmp/eidolon-release60-full-{client,lint,server}.log`.

Interface70333 passed6cases15.9s. Inspected desktop/phone sanctuary cards, phone
expanded journal and desktop long-label scene. Archive
`/tmp/eidolon-release60-interface-proof-0K6GU5`; scanner0 and web41961clean.
These controlled rendering fixtures do not substitute for native gameplay.

Native88699 passed1case36.4s (test35.1s), with no preparation or state grants.
An actual level1Wizard hovered Skeleton-lanternhold-1 fromx94.985 inside town,
then the same enemy fromx119.929 outside; the warning changed to InRange. Actual
combat caused2incomingdamage, and Fireball reducedMP110→80. Recall restored
HP108→110 and MP80→92→110. Earned bank11.385→11.771 and attached aura survived
fresh login. Both world boundary screenshots and the rejoined town image were
inspected. Archive `/tmp/eidolon-release60-native-proof-KPv2XQ`; wrapper sanitized
0files, supplemental scan0, exact disposable containers/18560/18561/41960absent.
Log `/tmp/eidolon-release60-native-final.log`.

Exact diff against59 was reviewed: runtime changes are the sanctuary target-card
status and presentation only; remaining changes are tests, release metadata and
documentation. Rechecked predecessor CI34414624304: all10jobs SUCCESS. Remote
master still e236b37 before publication. Public60 acceptance remains unproven.
