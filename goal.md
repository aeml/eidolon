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
Prior owned history remains byte-exact in the [archive](docs/plans/archive/2026-10-10-held-goal-execution-history.md).
Historical procedural-only instructions do not override supplied actors/modern ARPG.

Previous goal turn: **progress**, isolated live24 real-time jump correction;
110focused checks and3native source/published-bundle tests pass, built bundle
15FPS1547.4ms/60FPS1522.6ms with exact endpoints. Still staged, not deployed.
[Jump follow-up](docs/plans/2026-10-10-jump-live24-bundle.json).

Current turn: **progress**, private3207fb56 lossless prepared-geometry compaction.
180focused checks,64exact native gallery controls/32close originals,2published
cases and actual High party/Go-race/14slot-save pass. Retained buffers shrink
57.07%gallery and59.85%party, ordinary-shadow output exact. Final real-frame
ABBA source/compact both16.7ms medians; all exactp95/draw gates still fail.
Earlier33.3ms ABBA and slower submission CPU retained; no proven FPS gain,
peak/whole-browser memory qualification or default activation.
[Compaction and limits](docs/plans/2026-10-10-prepared-geometry-compaction.json).

- Public24/922753a7 still matches normalTLS frontend/backend; DBready.
  CI38030283856 attempt1 remains failed required expiry engine-module download;
  separate175Gold equality passed retry, original causes unknown. Three fresh
  unchanged24 recovery passes do not accept the failed gate. No rerun, successor
  push or24merge into held source. Live24still lacks the real-time jump fix.
- The24hour soak37880032315 completed failure: seven read errors and20.2538min
  common100client coverage. Health samples do not explain lost connections.
  Original evidence retained, no restart/cancel/substitute soak.
- Qualified selected private renderer, supplied Highv3 bodies, conservative
  local-matrix6553fec1, event-owned geometry delivery and staged jump correction
  remain. Geometry is explicitly integrated but default null/OFF. Rejected light
  membership/world-box/affine/cell prototypes remain unselected. Assets, skins,
  morphs, gear, authority, original saves and algorithms preserved.
- Current whole-game High/Low/close/device/cold/heap and modern moving equipped
  HUD/world/combat acceptance remain open; sampled gallery equivalence is not
  broad art/beta acceptance. Synthetic long names overlap; final screenshot
  heap380.1MB not qualified. Physical-phone/campaign feedback remains owner-deferred.

Next: inspect the observed lazy engine-module failure and qualify bounded safe
module-download recovery in an actual publication bundle, preserving failure
history and gate strength. Continue measured rigid-shadow/default submission
from current attribution using actual renderer light membership, avoiding the
rejected full-scene indexes/caches. Finish remaining High/Low/close/cold-memory/
support-device/moving-art and every original1.11–1.99 content/gameplay/story/
Dark Realm/economy/social/casino/UI/save/security/F1–F5/CB/operations/rights/
owner/human/beta/launch/handoff requirement. No unapproved access, commerce,
destructive production or invented owner-policy decisions. Goal remains active.
