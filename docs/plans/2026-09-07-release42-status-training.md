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

Final package `0d57f0e` passes **211 suites / 3,113 client tests in 73.66s**,
lint, root backend race tests (**7.576s**) and **53/53 anonymous desktop/phone
browser tests in 3.9 minutes**. Logs: `/tmp/eidolon-release42-full-client.log`,
`/tmp/eidolon-release42-lint.log`, `/tmp/eidolon-release42-server-root.log`,
`/tmp/eidolon-release42-anonymous.log`. Inspected 390px camera and Forge captures
retain the distinction between containment and full visual/physical-phone
sign-off; follow-up Forge design work is recorded in the shared phone layout.

The final versioned combined three-skill status route **passes on `ef6f47d`**:
Shadow Lunge **23.9s** (69/82/82), Serrated Edges **28.4s** (38/45/45), and
Poison Coating **34.4s** (67/80/80). All baseline/trained/fresh-login ticks retain
accepted cast identity and positive cooldowns. The artifact credential scan
passes with zero sanitizations, and the disposable runtime/data clean up
normally. Log: `/tmp/eidolon-release42-status-gameplay.log`. All local package
handles are terminal success; no local browser/server remains active.

The candidate is locally verified, not published. Preserve the sequential
1.0.38–41 publication gates; never push
this working HEAD over a predecessor still undergoing CI or live verification.
The larger 1.1–1.10, physical-phone, complete talent and offline-parity gates
remain open. This hotfix does not redefine or close the goal.
