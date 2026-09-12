# Release64 hosted acceptance and production promotion

Candidate: **6d5e82cb8f50dd9e76a1353bd024339eabc544e0**, Alpha1.0.64.
Scoped worktree `/tmp/eidolon-release64-defenses-20260912` is clean. It retains
release63 story/economy and does not publish the large development branch.
Login/version defaults and cumulative patch notes are included in this commit.

## Hosted rehearsal accepted

Workflow-dispatch CI34667225615 completed SUCCESS. This mode runs the complete
hosted tests and intentionally skips local-native/production stages. It is not
proof of deployment, live gameplay or full dungeon/1.1 completion.

- Client103481486712:288suites/4083tests PASS87.445s; lint/audit/benchmark passed.
- Server103481486620: full coverage game79.832s/85.3% statement coverage, full
  race game260.541s; backup/restore, benchmark/build and remaining job steps pass.
- Browser1/3 job103482587561:23+4+3+6+3 =39passed across its five stages.
- Browser2/3 job103482587639:23+3+3+11 =40passed across its four stages.
- Browser3/3 job103482587597:20+3+2 =25passed across its three stages.
  Together104passed; no failed/skipped cases reported in those stage summaries.

Logs were retrieved through the completed-job API, which works before the entire
workflow finishes (the early CLI whole-run log request did not):
`/tmp/eidolon-release64-hosted-{client,server,browser1,browser2,browser3}-34667225615.log`.

Retained complete report/image artifacts:

- `/tmp/eidolon-release64-hosted-shard1-ZaJkb6`
- `/tmp/eidolon-release64-hosted-shard2-vqMZid`
- `/tmp/eidolon-release64-hosted-shard3-CJXE89`

Inspected representative resource-HUD, phone stash details, ready-story label,
phone raid menu/combat composition and Rogue respawn appearance captures. No
glowing interaction cube in the tested Rogue respawn fixture; tested phone text
and primary controls remain readable. These isolated/mocked UI fixtures are not
physical-phone performance or multiplayer dungeon-playthrough proof. Preserve
the user's separately recorded positive actual-phone feedback without inventing
their phone/browser or broad device coverage.

## Production promotion

Verified remote masterf866df68 and fast-forward ancestry, then pushed exactly
6d5e82cb to master without force. No root ledger-only master was pushed. Normal
push CI **34668112188** began September12 at02:36:07UTC and remains active.
All hosted, complete native predeploy, deployment-input, frontend/backend deploy
and final live gates remain required; do not cancel on an observation timeout.

Independent uncached public checks at02:36:28 still show matching
Alpha1.0.63/f866df68 on frontend/backend, health ok/database ready. This is the
healthy predeploy baseline, not a64 deployment acceptance. Both repo runners
were online/idle when inspected after promotion. Keep shared browser hardware
free for required predeploy/live work; no soak or competing local native test
was started. The existing nightly schedule was not disabled.
