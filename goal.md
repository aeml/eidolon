# Goal: finish Eidolon through release readiness

Create an active, persistent goal to finish Eidolon in its entirety: complete
every outstanding requirement in the existing roadmap, deliver a polished
closed-beta-ready game, address beta findings, and complete the release-ready
1.99 candidate and operational handoff.

Do not redefine completion around a small patch, passing CI, or reaching a
version number. Preserve the original scope and work until every required
feature, content item, visual-quality requirement, integration requirement and
release gate is actually completed or explicitly resolved with the owner.

## Project and authoritative sources

Repository: `/home/aeml/Github/eidolon`.

Read the applicable `AGENTS.md` files, README, roadmap, art instructions, current
implementation and retained acceptance evidence before changing anything.

- Primary roadmap: [Alpha 1.11–1.99](docs/plans/2026-09-28-alpha1-11-to1-99-release-roadmap.md).
- Modern visual-quality contract: [modern ARPG art](docs/art/2026-09-28-modern-arpg-closed-beta.md).
- World population and atlas requirements: [world and atlas](docs/plans/2026-09-28-world-population-and-atlas.md).

Also reconcile `ROADMAP.md`, `docs/ROADMAP.md`, the promise register, milestone
checklists, unresolved issue registers and relevant `docs/plans` receipts.
Historical progress notes are not proof that their requirements are complete.

The prior root `goal.md` is preserved unchanged in
[the historical execution record](docs/plans/2026-10-09-goal-history.md).
Its September checkpoints are historical, not the current live state. Prefer
current source, external state and recent acceptance receipts when they disagree.

## What finished means

1. Complete all outstanding roadmap work, including unfinished requirements
   carried forward from earlier versions—not merely milestones 1.80–1.99.

2. Make the game look and feel like a cohesive modern dark-fantasy ARPG, using
   Diablo and Path of Exile as quality direction without copying their assets
   or claiming equivalent production quality. Finish environments, terrain,
   architecture, interiors, vegetation, roads, landmarks, world population,
   lighting, materials, shadows, atmosphere, effects, sound and UI. Judge
   results at ordinary gameplay zoom, in motion, with the actual HUD and
   equipped characters—not just isolated screenshots. Environment, texture,
   shader and lighting work is implementation-owned; do not shift that work
   into an additional external asset-production requirement for the owner.

3. Preserve and properly integrate the supplied Fighter, Rogue, Cleric and
   Wizard GLBs, equipment assets and animation banks. Finish equipment fit,
   material identity, animation quality, dual wielding, class restrictions,
   local/remote appearance and resource cleanup. Do not request assets already
   delivered or replace approved imported models with procedural stand-ins.

4. Finish gameplay quality across every class and specialization, combat,
   parties, dungeons, raids, checkpoints, the complete main story and Dark
   Realm finale, progression, item drops, crafting, rewards, economy, social
   systems, casino, administration and account recovery. Follow the existing
   documented rules and the owner's prior decisions.

5. Finish browser/mobile usability, accessibility, settings, performance,
   returning-save compatibility, persistence, security, release/rollback
   reliability, monitoring, backup/recovery, support workflows, documentation
   and asset/dependency notices.

6. Complete the roadmap's feature-freeze, closed-beta and release-readiness
   gates. Closed beta must wait until the entire game is nearly complete.
   Preserve existing accounts and characters; new beta players are
   invitation-based, with up to 100 planned. Do not change public access or
   declare beta/full release without the owner's approval.

## Working method

- Implement coherent milestone-sized improvements. Avoid dozens of tiny
  releases that consume time and usage without meaningfully improving the game.
- Publish completed milestones with cumulative patch notes and synchronized
  login, frontend, backend and deployment versions.
- Fetch and ordinarily merge remote changes before pushing. Another agent may
  update the website. Never force-push or overwrite their work.
- The original repository has substantial existing user changes. Preserve
  them and use owned worktrees for implementation.
- Verify each deployment succeeds and that the actual public assets,
  frontend/backend identities and database readiness match the intended build
  before pushing another release.
- Use focused, proportionate tests for changed behavior. Reuse valid existing
  evidence. Do not repeatedly rerun unchanged full campaigns, long soaks or
  expensive exhaustive checks.
- Use Luna for sparse monitoring of deployments and long dungeon/raid tests;
  have it report completion or failure rather than every tick. Do not delegate
  automatic retries, cancellations or production mutations.
- Diagnose failures from evidence. Do not blindly rerun jobs, weaken tests,
  lower performance targets, hide content or count skipped tests as passes.
- Keep an accurate, concise remaining-work register. Distinguish implemented,
  staged, deployed, verified and owner-approved work.
- Continue useful independent work while deployments run or individual owner
  decisions remain pending.

## Handoff to revalidate

The previous thread accepted Alpha 1.79.21 and pushed the prepared Alpha
1.79.22 actor-lighting correction:

- Commit: `30a8b6038df9e071eef0f57564ae94087d1a0b11`.
- CI run: `37967212738`, repository `aeml/eidolon`.

Recheck its actual current status and live deployment; do not assume it
succeeded or restart it solely because this historical checkpoint is stale.

Relevant owned worktrees:

- `/home/aeml/.local/share/eidolon-actor-normal-safety-7dSQ1f4X`
- `/home/aeml/.local/share/eidolon-raised-world-rollout-20261009-V4BWRffv`
- `/home/aeml/.local/share/eidolon-release-1792-wzYSrZ2Y`

The last contains detailed release/acceptance receipts, including
`docs/plans/2026-10-09-ready21-town-notices-publisher.json` and
`docs/plans/2026-10-09-ready22-actor-publisher.json`, but also staged future work.
Do not wholesale merge it into production. Inspect these worktrees before
assuming any candidate is still clean or unchanged.

Raised terrain and broader equipped-party/device qualification remain
unfinished. Modern-art acceptance and the complete 1.80–1.99 gates remain open.

An existing long-running soak was intentionally left running: Actions run
`37880032315`. Inspect its current state if relevant, but do not cancel or
restart it without authorization. A stale process identifier or receipt alone
does not prove the test is still running; inspect authoritative state.

## Boundaries and completion

The owner deferred uninterrupted campaign/pacing validation and physical-phone
party/dungeon feedback to playtests. Do not secretly substitute another
expensive automated campaign or mark missing human feedback complete.

Do not invent owner decisions about payments, licensing, policies, recovery
objectives or release approval. Do not enable commerce, change retention/access,
wipe data, make real purchases or perform destructive production experiments
without explicit authorization.

Ask concise questions only when a genuinely missing decision affects the result;
otherwise continue with safe, in-scope implementation. Do not repeatedly ask for
unanswered decisions already recorded; continue other available work.

Keep the full goal active until requirement-by-requirement evidence establishes
completion. If something requires owner approval or outside input, identify
exactly what remains and continue other available work. Never claim the entire
project is finished merely because the latest deployment is green.

## Current checkpoint (2026-10-10)

The requested jump is deployed in Alpha1.79.25/d15a882e and independently
verified on the actual public game: real27unit Ctrl-click,1648.6ms total,
1582.9ms observed flight, accepted1.5s, logical/render landing errors0.
Normal-TLS frontend/backend/database and eight public asset hashes matched.
Required CI38051193149 nevertheless failed exact live Gold/stash checks;
all nine other jobs passed. Original failure/root cause remains retained.

Current deployed Alpha1.79.26/77859697a71329facd0584a95167c80eac392398 matches
normal-TLS frontend/backend/database and all eight independently hashed assets.
CI38056289769 attempt1 nevertheless completed failure: nine other jobs pass;
live gameplay fails initial unchanged stash Gold385761→385936 and configured
retry exact sale Gold386536→386711, both +175. Correlated fresh baselines pass,
so the preceding242/175Gold FIFO controls do not repair the original live issue.
Native7pass/1unexpected/1skipped; later required recovery/optional four-class
stages skipped. See `docs/plans/2026-10-10-public26-terminal-verification.json`.
Original economic cause remains unproven; diagnose before another publication.
No manual reruns/cancels/waivers or public24/25/26product merge into held.

Private diagnostic1c7cbd90 proves a fresh wallet read can be correct while
ordinary sale/stash bag work then delivers separately earned room Gold:
four Go-race controls pass, actual level40/elite-ambush/fortune1 award175,
exact saved receipt/feedback/custody and no repeated award. Product unchanged;
modeled storage/filesystem journal, no native/Mongo/public-cause inference.
See `docs/plans/2026-10-10-gold-room-reward-boundary.json`.

Follow-up a69cd244 now qualifies that separate-earned175Gold path through
actual native/browser/server/Mongo:2native pass43.4s, Go-race48.10s/pkg49.161s,
freshGold1000, exact final1178sale/1175stash,EP43,earnedXP,original14slot gear,
exact bag/stash/frozen-item metadata and completed immutable reward receipts.
Only diagnostic host reads select the post-award schedule; all packets/client
loops/balances/predicates remain ordinary. Prior unpaced native failure/pass
schedules and observer harness failure remain retained, not waived. Actual
public cause still unproven. See
`docs/plans/2026-10-10-gold-room-reward-native-boundary.json`.

Separate private world/maintenance integration14d4ea1f ordinarily merges held
9d724663 and exact public26, retaining held art/models/render/movement bytes.
469checks/6suites and focused Go-race checks pass; actual copied/versioned
publication passes native60/15FPS login/startup recovery/accepted1.5s jump and
fresh login/direct Mongo saves on explicit raised terrain. Click→landing
1688.5/1617.9ms, endpoint errors0, exact Gold/EP/gear/bag retained. Geometry
owner stays null. Private only; no Gold-cause, whole-High/device/art acceptance.
See `docs/plans/2026-10-10-world-maintenance-integration.json`.

Private5c5494ef shadow integration remains defaultOFF/unselected;36owner checks
and actual connected High native/Go-race/party-save checks pass. ExactRGB0change,
390→362draws; submission CPU regresses and ABBA frame medians remain16.7ms.
WholeHighdraw/triangle, physical-device and art gates stay open.
See `docs/plans/2026-10-10-actor-shadow-connected-gameplay.json`.
Prior bf2039bf isolated32units/12native/70RGB proof remains valid within scope.
No performance/art/device selection inferred. Full original1.11–1.99objective,
failed24hsoak, art/device/owner/F1–F5/beta/launch/handoff gates remain open.

Latest corrective milestone: the owner repeated approximately1.5second TOTAL
jump time. Candidate1.3second server/client flight qualifies1504.9ms normal and
1459.9ms15FPS, exact endpoints/fresh-login/Mongo custody. Actual public26
one-run provenance38061055843 proves separate earned175roomGold after exactsale;
read-only QA ledger now checks those separate credits exactly, with all loss/
extraGold controls and actual prior-credit/custody receipts retained.
Combined Alpha1.79.27/392c4a79 pushed; exact CI38062443230 is in progress.
Verify actual deployment/assets/one public jump/required native gates without
reruns or waivers. Full original1.11–1.99 goal and all remaining gates stay open.

Private world/total-jump integration ddadf7c9 is qualified without selection:
actual raised-world normal/15FPS totals1511.8/1411.7ms,2native/128focused pass,
exact endpoints/fresh saves, geometry owner null. Public27 deployment and full
required CI remain pending; full original scope and all unresolved gates stay
active. See world-total-jump-integration receipt.

Public27 candidate392 CI38062443230 failed before deployment due to missed
published-bundle minimum1500ms. Actual new flight landed1393.7/1425.2ms, then
configured retry1447.1/1339.9ms, endpoints0. Original outcome/archive retained.
Only that test now matches source fixture1300–1550ms: native1pass7s,1356.4ms15FPS
and1318.8ms60FPS, endpoints0. Follow-up a9d6fc9b ordinary-pushed; new exact
CI38064138468 is in progress, not a manual rerun. Runtime unchanged. Version27
remains undeployed; verified public26 and failed required prior gates retained.
Full original scope remains active; public deployment/jump proof pending.
