# Alpha 1.0.59 — deployed, final live verification pending

Checkpoint September10,00:03UTC. This release is deployed, but is NOT yet fully
accepted: its final live gameplay job is still running. Do not push a successor
until that job and fresh matching public identity checks pass.

Canonical commit: `e236b37c6110f0307985ecb29574bbcdaec7d0f0`, branch
`release/59-quest-and-combat-interface`, worktree
`/tmp/eidolon-interface-release59-S4ykfn`. Root documentation branch is never pushed.

Player-facing scope: clearer daily/story journal layout, ready/accepted ordering,
phone-readable rows, actual target levels, honest attack-power/cast-cost previews
and readable long action labels. Login and per-version patch notes identify59.
No expanded campaign, new progression curve, changed rewards, casino runtime or
the later sanctuary warning is included. The casino requirement is roadmap-only.

## Observed release gates

[Workflow34414624304](https://github.com/aeml/eidolon/actions/runs/34414624304)
matches the exact canonical commit. Server/client/allthree browser groups passed.
Predeploy102681209941 passed September9,23:56:45UTC, after41m19s; its gallery and
full disposable-character gameplay both succeeded. This elapsed time is an
observation, not proof that a proposed CI optimization has shipped.

Production input validation passed23:56:52. Server deployment102690489159 passed
23:57:19; Pages deployment102690489108 passed23:57:34. The server log retained the
previous recovery58 image as
`eidolon-api:rollback-ac8ab588194cd31d67844dd5f65bc42a1c6adfdbbf95a49a8a7b2b7fa8719b00`.
Schema preflight reported database9/supported9: no schema upgrade occurred or new
upgrade backup was needed. Local copied deploy log:
`/tmp/eidolon-release59-server-deploy.log`.

Fresh uncached public checks around23:58–00:00 observed:

- `/release.json`: Alpha1.0.59 and the exacte236b37 commit above.
- `/`: login label Alpha1.0.59, corresponding patch notes, and the exact release
  key on the main module URL.
- `/src/main.js?release=e236b37c6110f0307985ecb29574bbcdaec7d0f0`: GET200,19736bytes.
- Backend `/healthz`: statusok, databaseready, samecommit and Alpha1.0.59.

Final live job102690642047 started23:57:36 and remains ACTIVE in its anonymous/
persistent-character stage. It must also finish four-class/remote-animation and
town-recovery/WellRested checks and artifact sanitization/upload. Intermediate
deployment success and matching manifests alone do not complete acceptance.

- [ ] Inspect terminal final live QA result and retained evidence.
- [ ] Repeat fresh public manifest/login/runtime/backend identity checks.
- [ ] Record final acceptance before any successor push.

Full1.1–1.10 scope, fresh campaign/class/group balancing, real-phone verification
and other documented roadmap requirements remain open regardless of this release.
