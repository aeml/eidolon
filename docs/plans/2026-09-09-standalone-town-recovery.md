# Alpha 1.0.58 candidate — a reason to come home

NOT published or accepted. Standalone town healing/Well Rested candidate after
canonical57/cc6e419; starts from retained badd0cf recovery implementation. This
separates publication from the expanded Chronicle/reward-curve candidate, which
remains required by the full roadmap and is preserved in the primary worktree.
No earlier queued version is replaced or skipped. Never push the ledger root.

The production feature is the existing scene-scoped safe-zone registry, living
10%-per-second pool recovery, fractional persisted rest (schema9), stat/kill-XP
bonuses, remote/local UI and golden aura, plus safe-zone enemy AI/slam fixes.
The detailed arithmetic and historical evidence are in
`2026-09-08-well-rested-implementation.md`; historical passes are not new-build
passes. Current57 resources, auctions, quest access and legacy reward budgets
remain unchanged. Do not describe the existing8000XP collection payout as a
completed balancing pass. A later coordinated story/economy release remains due.

Normal earned collection QA now returns to town using the player's actual class
costs and ordinary Recall/travel/healing, matching the explicit player request.
No Wizard-only assertion or invented30mana default for other classes. It retains
120s encounter/two-respawn/quest-drop/turn-in gates and explicit no-rest diagnostics;
the latter do not independently block release for lack of sustained resources.
No imported expanded hunts, new curve, inspection sites or main-story rewrites.

Versioned login/history/package/manifest/backend/deploy metadata is58; this is
candidate identity only. Player notes explicitly explain10% pools,1:1 accumulation,
7200s cap, outside-only consumption, stats/kill XP, offline policy, death behavior,
aura/stealth and unchanged broader progression. All older notes remain intact.

The full required QA chain retains every earlier command, then adds fresh actual
rest/combat/reconnect, natural expiry/Recall and two-player phone High/Low aura
routes. Each uses its own ordinary registration, separate from earlier progressed
characters; first-command failure propagates before the party route can run.
Focused `well-rested-all` executes the same function. These are not synthetic
clock/resource grants; phone coverage is Chrome emulation, not physical hardware.

## Evidence and remaining release work

- Policy36436 PASS3suites36tests1.352s, lint and client preparation completed.
- Version80525 PASS3suites257tests2.787s, lint/shell/diff passed before the extra
  three-route full-gate wiring. Logs `/tmp/eidolon-standalone-rest-*`.
- Final gate46459 PASS4suites261tests2.197s, lint/shell/diff pass with the added
  real-rest function. Main gameplay source is unchanged from badd0cf; later edits
  are recovery QA policy, version metadata, notes and release-route coverage.
- Full current-source client and Go race regressions, actual normal collection
  across classes and newly wired real-rest routes remain required.
- Verify ordered53–57 publication, exact58CI/deployment/live identities and
  real live healing/buff behavior before calling this feature delivered.
