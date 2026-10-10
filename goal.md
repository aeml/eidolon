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

Previous public Alpha1.79.26/77859697 retained matching
normal-TLS frontend/backend/database and eight public assets. Required
CI38056289769 nevertheless failed live Gold/stash; later recovery/optional
four-class steps skipped. Earlier failed releases stay retained, never waived.
See public26-terminal-verification receipt. Its observed sale cause is now
established by actual one-run38061055843: fresh387855 + sale1500 →389355,
separate earned-room175 →389530, one sale/complete trace/decodeErrors0.
See live-gold-provenance receipt; no claim that every older failure is explained.

The owner requests approximately1.5seconds TOTAL click-to-landing. Public25's
1648.6ms at flight1.5s is historical. Corrective27 server/client flight1.3s
qualifies actual copied/versioned connected1504.9ms normal/1459.9ms15FPS,
exact endpoints/fresh-login/Mongo custody. Exact earned-room QA ledger and
negative/prior-credit/custody checks qualify without economic runtime changes.
See jump-total-time-release27 and earned-room credit evidence.

First27 candidate392c4a79 CI38062443230 failed before deployment because one
published-bundle test incorrectly retained minimum1500ms. Actual new flight
landed1393.7/1425.2ms, configured retry1447.1/1339.9ms, endpoints0. Corrected only
that test to same1300–1550ms as source fixture; native1pass7s,1356.4ms15FPS and
1318.8ms60FPS, endpoints0. Follow-up a9d6fc9b ordinary-pushed; exact unchanged
CI38064138468 attempt1 completed success. Both27 deployments succeeded;
normal-TLS identities/database and all eight actual assets match. One actual
trusted public27 Ctrl-click lands in1429.7ms, accepted1.3s, distance26.966,
logical/render errors0; native1pass/no gameplay retries/flakes/skips. A preceding
missing local vendor setup failed before navigation/registration/jump, retained
and corrected without gameplay changes. Public jump requirement is verified.
Required full live character/recovery outcomes passed: native8expected/1skip,
0unexpected/0flake, all retry0; separate recovery2+1 pass. Optional connected
jump/four-class routes remain skipped; actual public jump has separate proof.
Exact release checks accepted, full goal remains open. Terminal native/archive
inspection and frozen984-entry inventory retained in public27-terminal-verification.
No manual reruns, cancellations or waivers.
See release27-published-timing-correction receipt.

Private world integration ddadf7c9 qualifies actual raised-world normal1511.8ms/
15FPS1411.7ms,2native/128focused pass, endpoints0 and exact fresh saves. Geometry
owner null, held art/render/runtime unchanged except intended1.3s Movement cap.
Follow-up private72038fb3 carries the test correction with runtime identical;
511edfaa updates optional connected timing to trusted click; its exactly matching
acceptance body passed on public27, with no separate optional execution claimed. Nothing selected or publicly rolled out here.
See world-total-jump-integration receipt. Existing geometry/shadow pilots remain
unselected/defaultOFF; whole-High/device/art acceptance stays open.

The failed24hsoak has only20.2538minutes of common100client coverage and seven
read errors; no replacement/restart or explanation claimed. Owner-deferred
campaign/phone feedback, every outstanding original1.11–1.99 requirement,
art/device/owner/F1–F5/beta/launch/handoff remain active. The remaining-evidence
register and linked receipts retain detailed boundaries and prior outcomes.

Actor scratch-storage3aea15aa remains unselected after69focused, exact High/Low
pose and actualHighparty/save checks: synchronous CPU reference9.0/9.85ms
versus10.6/11.35ms candidate gives no gain.720real frames16.7msmedians have
changing draws/population; no causal frame claim. See actor-frame-storage-unselected.
Current Low geometry-owner first failed due missing local compiled worker;
original failure retained. QA-only eeed562f guard verifies rejection before DB/
accounts; prior byte-exact worker prepared. Corrected native1pass1skip26.0s,
actual four-class14slot saves exact. Low180frames16.7msmedian/p95,175draws pass
sampled limits but89377triangles fails85000; frozen scene85491 also fails.
Default owner remains null. Rigid supplied weapon source census10604triangles
identifies bounded coverage next; preserve close detail and original GLBs.
Guard carried privately as11df89b4 with runtime identical511edfaa. See
world-geometry-low-qualification. Full unchanged gates remain active.

Rigid equipment09fba6f8/de9c9a15 now qualifies actual supplied High/Low hand
gear through the existing optional owner:86focused checks, copied immutable
worker/offline cases,64gallery controls/32exact close and normal moving/save
parties. QA-only pool assertion correction retains11skinned+10rigid pieces;
original native failure and no-test selector setup failure retained. Frozen
evidence inventory b8d227aad6ecddc913b3a2cbe76f5b1a3d1b6a914251cf8ddfdc405dddcbea78.
Same frozen scene rigid-only saves3356Low/19304High rendered triangles. Actual
Low180frames179draws/85056triangles/16.7msmedian+p95 still fails85000triangle
limit; do not rerun unchanged for a lucky population. High334draws/181569tris/
16.7ms passes sampled limits, with ordinary shadows and no view pilot. Private
integration fast-forwarded to exactde9c9a15; default remains null and public27
unchanged. Next: meaningful Low scenery margin preserving plants/leaves, High
recipe and wind bounds; wider device/combat/art/activation gates remain open.
See rigid-equipment-geometry-qualification. Full original goal remains active.

Latest Low detail011fddda closes sampled geometry margin with every7439plants
retained: two ribbon sections, sedge80-to48/fern231-to217triangles, all roots/
tips/fern leaflets and exact transforms/tints/wind bounds. High position/color/
normal SHA256 goldens and spatial geometry remain byte-exact.24distinct units
pass across retained first obsolete expected-recipe failure and corrected4test
spatial suite. Actual Low1native pass1skip27.9s/allretry0,180frames158draws/
80382triangles/16.7msmedian16.8msp95 passes sampled normal-gameplay limits.
Independent same-scene prior/current vegetation saves3248triangles at158draws;
all7439plant transforms/tints exact, zoom15and5visual differences inspected.
Frozen76-entry inventory f58c7be7e33088755dc132e08f3c0bc927935682d677e8ace53e70bb6f834170.
Private integration fast-forwarded to exact011fddda. Prior de9High sampled pass
is reused only for unchanged High behavior. Default geometry remains null;
public27 and held runtime unchanged. Next: actual cold/returning default startup,
worker fallback, quality replacement and session/resource lifetime qualification
before activation; representative combat/device/final-art gates stay open.
See low-understory-detail-qualification. Full original goal remains active.


Default geometry startup fa2f7075 is now functionally qualified and ordinarily
merged into the held private milestone (cb4cd6c8; tooling41f595cc). RenderSystem
owns bounded delivery by default; worker starts only at first valid source,
originals remain visible and worker failure retires prepared copies.87distinct
focused checks pass;14native passes/2skips/retry0 cover immutable/offline worker,
actual worker exception, quality reload, High/Low session/resource lifetime,
scene cycles and transport recovery plus actual server/Mongo four-class14slot
parties. Original test-mock failure retained. Default Low38entity180frame sample
175draws/84361triangles/16.7msmedian+p95 passes; High39entity417draws fails350,
191783triangles/16.7msmedian+p95 pass those sampled limits. Never substitute
prior22entity334draw High sample for this actual failure. Null view/shadow pilots
stay off. Normal npm preparation now builds the exact worker (44e0c67c), proven
from missing artifact with preflight rejection before binary/DB/accounts.
Runtime evidence133-entry inventory691d3a1091edeab06ff6c9495ec096163defd2f28957a442bd4b65fd7a64a92d;
separate tooling5-entry inventorya27335c99fb0d715aba14750baeb0f9edf1ee83b73ef11c55ae7b69c3ec9b2a7.
Held runtime byte-exactfa2; private integration44e0c67c; no public mutation.
Public27 release identity, Movement and engine bundle were read-only rechecked,
all hashes match; trusted public1429.7ms jump proof remains valid. Next: measured
High shadow-draw reduction with conservative current-pose influence, exact
visible shadows and unknown-light fallback; preserve350draw target. Combat,
devices, art, every original1.11–1.99 requirement and owner-deferred campaign/
phone feedback remain active. See default-geometry-startup-qualification.
