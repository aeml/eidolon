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
- [ ] Full client/lint and server-race regression on the versioned candidate.
- [ ] Final interface and native smoke on the versioned candidate, retained evidence.
- [ ] Review exact diff against59, then normal canonical push.
- [ ] All CI/predeploy/deploy/final live checks and fresh public60 identity.

Full1.1–1.10 completion remains open. This targeted release must not be presented
as completion of campaign, balance, phone ergonomics or the full visual goal.
