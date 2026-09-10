# Alpha 1.0.59 — accepted live release

Accepted September10,00:12UTC after all ten workflow jobs passed, fresh public
identity checks matched, and retained live evidence was inspected. This closes
release59's acceptance only, not the full roadmap or any unshipped prototype.

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

Final live job102690642047 passed September10,00:09:48 (12m12s). Anonymous and
persistent-character checks passed8cases/5.2m; four classes and remote animations
passed; real town recovery, natural rest expiry and two-player High/Low phone
checks passed. Artifact sanitization/upload also succeeded. Entire workflow is
completed/success, not merely an intermediate deployment success.

- [x] Inspect terminal final live QA result and retained evidence.
- [x] Repeat fresh public manifest/login/runtime/backend identity checks.
- [x] Record final acceptance before any successor push.

Fresh00:10–00:11 public GETs repeated the exact59/e236b37 manifest, login label,
main-module releasekey, HTTP200/19736byte runtime and healthy ready backend.
Native recovery observed real incoming damage, an accepted Fireball with MP80,
Recall recovery fromHP108/110 and MP80→92→110, and saved bank12.179→12.634 across
login. Separate natural expiry removed aura/stats at0 and restored them on town
reentry. Two actual party members had19High/10Low aura meshes and joystick movement.

Retained live archive `/tmp/eidolon-release59-live-proof-H4inF4` (artifact10130538822)
and predeploy archive `/tmp/eidolon-release59-predeploy-proof-DdT6Xj`; scan0 after
download. Inspected live rested-rejoined desktop and Low-quality390px party-world
screenshots, plus predeploy town-nameplate/High-quality390px party-world views.
Logs `/tmp/eidolon-release59-final-live.log` and server deploy log above retained.
These are real browser checks, not physical-phone sign-off or an earned full-story
clear. The UI fixture evidence and local full regressions remain documented in
the canonical release59 interface acceptance plan.

Full1.1–1.10 scope, fresh campaign/class/group balancing, real-phone verification
and other documented roadmap requirements remain open regardless of this release.

