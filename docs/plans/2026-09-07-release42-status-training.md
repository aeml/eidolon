# Alpha 1.0.42 — every wound remembers

Queued candidate after preserved 1.0.41 `63fcc67`; not published. Integration
`4e05228` includes [status Mastery and entrance targeting](2026-09-07-status-training.md).
Separate patch notes preserve all earlier entries. Login/package/manifest,
CI and Go/container/deploy/isolated-runner version defaults advance together.

Game source has passing full client regression (211 suites / 3,112 tests), full
server race plus additional rune-only/shared-contract tests, and individual
ordinary browser baseline/trained/fresh-login checks for all three repaired
skills. The evidence record retains exact source checkpoints and test limits.
Packaging adds no additional game behavior. Version/history/default checks pass
**216 tests in 0.895s**, plus shell syntax and whitespace checks.

Remaining local package gate: final anonymous desktop/phone browser regression
and final lint. Preserve the sequential 1.0.38–41 publication gates; never push
this working HEAD over a predecessor still undergoing CI or live verification.
The larger 1.1–1.10, physical-phone, complete talent and offline-parity gates
remain open. This hotfix does not redefine or close the goal.
