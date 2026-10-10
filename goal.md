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

## Current execution checkpoint — October 10

The full146line owner objective above remains authoritative. Its handoff IDs
are historical. Current evidence is in the [remaining-work register](docs/plans/2026-10-09-release-readiness-remaining.md)
and [checkpoint](docs/plans/2026-10-09-remaining-evidence-checkpoint.json).
Prior owned history is preserved byte-exact in [the archive](docs/plans/archive/2026-10-10-held-goal-execution-history.md);
its procedural-only instructions do not override supplied-model/modern-ARPG requirements.

Previous goal turn: **no progress** toward the broad objective; it reverified
the existing public1.5s jump cap. This turn: **progress**, preparing exact-source
worker delivery with145focused checks,32native pose/zoom controls/16exact close,
and actualHigh/Low four-class/14slot/movingHUD/race/save evidence. Private11be4c67
is merged inactive; no default controller/delivery import or public activation.
[Delivery, original failures and limits](docs/plans/2026-10-10-gameplay-geometry-worker-delivery.json).

- Accepted jump23/2e519bb0 caps client/server flight at1.5s; bounded realCtrlclick
  landing was1.641s including display overhead.24jump source is unchanged.
- Public24/922753a7 remains deployed and unaccepted. Fresh normalTLS frontend/
  backend/bundle match,DBready, but CI38030283856 attempt1 is still failed at
  mandatory live expiry engine-module/module-download startup. Separate175Gold
  equality failed then passed retry; neither original cause is proven.
  Private91check QA diagnosis/vendor sequencing remains selected, including
  three fresh unchanged24recovery/party passes, without a CIrerun/waiver/24merge.
  [Startup/Gold evidence](docs/plans/2026-10-10-live-failure-diagnostics.json).
- Whole-render geometry preparation26d475d7 preserves complete source attributes,
  skin/bones/blink/materials and exact close views, with four stable nativeGPU
  cycles. New worker prepares live coverage/fitted sources, never transfers live
  buffers, rejects stale generations and bounds pending/copy/cache/timeout work.
  Outfit restore, detach/reattach and stealth restore each reacquire11cache hits
  in the native gallery. Production actor/replacement/renderer and worker build/
  version/offline delivery are still unfinished; default renderer does not use it.
- Actual defaultHigh268calls/181443triangles/16.7median meets those targets, but
  rawp9533.400000000001455 exceeds exact33.4. DefaultLow151/82828/16.7median/
  33.400000000001455p95 meets this bounded scene. High/Low populations28/46 and
  mixed source-bypass submission timing prohibit cross-run or broad gain claims.
  Close originals still412792/129665triangles, over geometry targets. Supported
  devices, memory, cold delivery and full moving modern-art remain unqualified.
- Rejected light/world-box/affine/cell-matrix experiments remain unselected.
  Required24hsoak37880032315 stays failed; no restart or substitute unchanged
  campaign. Owner-deferred campaign/pacing and physical-phone feedback remain
  missing human evidence. No commerce/access/retention/policy decisions implied.

Next: preserve original public/Gold/soak failures; deliberately integrate actor
and renderer ownership plus worker publication/cache/version lifecycle, then
qualify absent installation/reference, High/close/default HighLow, devices,
memory/cold delivery and moving art. Continue every original1.11–1.99/gameplay/
Q/CB/F1–F5/operations/rights/owner/human/beta/launch/handoff requirement. No
successor push, public/profile activation, failed-gate waiver or24merge occurred.
