# Alpha1.0.60 — publication and pending live acceptance

Canonical commit `df91bb66e8e8f3b7125aa99412f09ba25898a3ac`, branch
`release/60-sanctuary-combat-feedback`, worktree
`/tmp/eidolon-safe-zone-release-preview-gCLEaT`. Normal non-force push from this
worktree succeeded after accepted59/e236b37 and complete local checks. Root is
ledger-only and is never pushed. Do not push a successor before60 is accepted.

Player scope: the target card explains that a player must leave a safe zone to
attack ordinary enemies, and normal range feedback returns on departure. Valid
duel feedback remains intact. No changed protection, casting, costs, damage,
recovery, Well Rested, progression or reward rules. Version/login/patch notes and
all build defaults identify60. Expanded campaign and casino are not runtime scope.

## Local release evidence

Tested runtime/version commit2b30320; finaldf91bb6 adds documentation only.
Full33981 passed253suites3599tests75.35s and lint, plus all server-race packages
(game229.897s). Logs `/tmp/eidolon-release60-full-{client,lint,server}.log`.
Final interface70333 passed6cases15.9s; inspected desktop/phone warning cards,
phone journal and desktop long-label scene. Archive
`/tmp/eidolon-release60-interface-proof-0K6GU5`, scanner0.

Final native88699 passed1case36.4s. Real unprepared level1Wizard saw the warning
inside town atx94.985 and InRange on the same enemy after departure atx119.929.
Actual enemy damage2HP, acceptedFireballMP110→80, RecallHP108→110/MP80→92→110,
and bank11.385→11.771/aura persisted across login. Both boundary images and the
rejoined town image were inspected. Archive
`/tmp/eidolon-release60-native-proof-KPv2XQ`, wrapper sanitation0files/supplemental
scan0, exact disposable services/ports cleaned. Native log
`/tmp/eidolon-release60-native-final.log`.

## Required public acceptance

[CI34421323405](https://github.com/aeml/eidolon/actions/runs/34421323405) is confirmed
ACTIVE on the exact canonical commit. Client tests have passed; server tests are
still running at this checkpoint. Later browser/predeploy/deploy/live stages have
not been accepted. A successful push or intermediate job is not live delivery.

- [ ] All client/server/browser/predeploy/input validation jobs pass.
- [ ] Both deployments pass; inspect server schema preflight and rollback evidence.
- [ ] Final live native/character verification passes; preserve and inspect evidence.
- [ ] Fresh public manifest, login/patch notes, release-keyed runtime GET and healthy
  backend all identify the exact60/df91bb6 release after the final live job.

This does not complete the broader1.1–1.10 goal, campaign/class/group balance,
physical-phone playability, full dungeon/raid story or two-floor casino scope.
