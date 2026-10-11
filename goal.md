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


Conservative actor shadow influence e8eec1b9 now ordinarily selected only in
held/private integration.89 focused checks and9 default native checks/34exact
RGB pairs pass; High/Low retired owners release roots/listeners/caches and
warmed scene transitions remain stable. Actual default High33entity180frames
324draws/176626triangles/16.7msmedian+p95 passes sampled limits. Frozen same
scene390→330draws RGB0, source repeats exact; independent prototype417→317
also exact. Original supplied skins/source geometry/color remain intact;
unknown/deformed/light paths keep original shadows. Actual four-class14slot
Mongo saves pass. Frozen259-entry inventory6571931292cac7ae8d408156b3a95986bb99e39f6757762dd0e3952d4f0c5c43.
Actual defaultLow30–31entities202draws fails200,79857triangles/16.7ms pass.
Preserve this failure; older175draw Low window is not universal acceptance.
Following Low rigid color-view378a79a2 remains unselected:90focused/11native
functional pass, exact RGB and2588triangle reduction, but154→154draws unchanged.
Strict actual native draw-gain assertion fails before following motion/profile/
final save; no acceptance claimed for these unexecuted steps.69-entry frozen
inventory12e39d8899cc46a4eff80c244f8292f47282b7097d69cc075a50bb78d5a15b89.
No public mutation. Next: attribute actual Low batch splits and qualify meaningful
submission consolidation with exact transforms/64unit float32 origins and source
assets preserved; retain200draw/85000triangle limits and native real-party saves.
Then full ordinary equipped/HUD town/Earth/fight/dungeon approach, representative
combat, art and supported devices remain active. Every original1.11–1.99 item,
owner-deferred campaign/phone feedback, failed24hsoak/F1–F5/beta/launch/handoff
remains open. See actor-shadow-influence-qualification and low-actor-view-unselected.

Held normal preparation initially found its older dependency symlink lacked
esbuild. Original setup failure retained; only owned ignored symlink repointed
to already validated current tree, then normal npm preparation passes and exact
worker44618fbd/source runtime verified. Separate3-entry integration inventory
40e485e5e588c17e35cb9dacfe1ca69d14065df222c401163c1bfee77dd6277a.

Owner-priority continuation: jump/aura/admin corrections fd852472 qualified and
public28/77a48916 ordinarily pushed; CI38076277436 remains in progress.182 focused
checks,401 overlapping version/history checks, focused Go-race tests and9 native
public-source/bundle checks pass. Legacy jump25/27 generated fixtures and exact
configured automation names are now classified separately from real players;
no role inference, account deletion or save mutation. Frozen123-entry inventory
42ffdfffe88a217c8afd400b4b25ce4d5b2fcb9df33e3cc2076ebca24063d621.
Final review found a remaining midair tuck discontinuity in all four classes;
source561d392d/held1e60f126 corrects it with73 focused/2 native checks. Initial
syntax failure and native failures retained. Stage after28 deployment is verified;
no second public push while its release gates are outstanding. Full original
roadmap, Low202draw failure, art/device/soak/beta/launch/handoff scope stays active.

Jump29 follow-up is prepared locally as ce7846b3 after additional regression
proved an older walking correction could replay after landing. f9479908 retires
that correction while preserving the displayed takeoff offset;74 focused,466
combined release checks and3 source/compiled-publication native checks pass.
Not pushed while28 gates remain outstanding. Frozen15-entry handoff inventory
a7fb3014f585ca9062462d55036739e36004871b2c5bee2d00c41eb539d4586f.
Independent actual Low submission census5912fb46 changes QA only, retaining
2fee/e8 runtime byte-exact. Actual1native pass/1skip and Go-race four-class14slot
saves pass.32 rigid handgear color calls and24 procedural instance buckets;7
compatible sibling groups estimate8 possible draw reductions. No optimization
or draw gain accepted. Rigid simplifier currently rejects flat PBR attributes;
material partitions and qualified index derivatives must survive any batching.
26-entity146draw/69813triangle/16.7ms sample is a different population and does
not close prior Low31-entity202draw failure. Missing ignored vendor preflight
failed before accounts/DB, normal preparation resolved; both outcomes retained.
Frozen60-entry census inventory9aa32ceeceabe932813cfc203dbcad7bfa094f932a16b1cbae76e0ac9f85416e.

2026-10-10: Public28/77a48916 exact CI38076277436,8assets,frontend/backend/database verified; long jump1426.3ms,auraerror0. Walking sample gates failed and remain retained. Public29/12e5e3c4 pushed after28 verification, CI38078784320 running: midair pose, old walking-correction replay and1.661538unit first-ack backstep corrected,85focused/477public/3native checks passed. Exact29 live acceptance pending. Full original scope unchanged.

2026-10-10 final scoped motion/admin receipt: Alpha1.79.29/12e5e3c41a3b4e897138973a7514fc8da7881bcb accepted live. Exact CI38078784320 success attempt1, all10jobs and required live steps pass;8native pass1skip0flake0retry plus3recovery pass. Normal TLS8served files match,frontend/backend identity and database ready. Trusted native jump1396.8ms with64aura samples,error0,phasebacksteps0,renderpatherror0,endpoints0; sustainedwalking88genuine frames,auraerror0,20.592units. Running configuration excludes6QA identities; owned real-Mongo population fixture1pass0skip verifies real/test/all paging and daily summaries. Frozen2888-entry inventory740010fcdfbff1d58707d822cbe14e128359711e99ffaed9f54bd2610b0b1ee3. See `2026-10-10-public29-terminal-qualification.json`. These owner-requested fixes are complete; full original roadmap remains unfinished, including held world/default geometry/shadows, unselected rigid batching with High389/350failure and historical Low202/200failure, art/devices/failed24hsoak/F1–F5/beta/launch/handoff. No additional public push.

Private same-cell actor multi-draw runtime702a2755/sourcebcbc7147 remains unselected and unpublished.71focused checks and12animated/far/sheared plus10recorded238instance/72bucket/3origin native comparisons preserve exactRGB and triangle counts. Initial native sort failures retained; original color depth order versus shadow scene order is now preserved. Native mid-frame failure cleanup and reference-again geometry/texture counters pass. Actual Go-race four-class14slot saved parties pass High/Low: frozen same-scene256→244/195→174draws retain162659/87584triangles andRGB0. NormalHigh242draws/162655triangles/16.7median+p95 passes this sample; Low178draws passes200, but87602triangles FAIL85000. Newly owned geometry404160/549696bytes and matrix+indirect textures30824/46580bytes are explicit, not zero-cost. Different populations cannot waive historicalHigh389draw/Low202draw failures. Frozen162-entry inventory57c09dbeeb090266d08dc2113600350bd42a4ca069227e86aedb355d3fbc8854; receipt `2026-10-10-actor-cell-multidraw-qualification.json`. Next: attribute and resolve Low triangle excess with strict visual/source/culling proof, then ordinary default/startup/pool/dynamic-membership and representative device/world/combat acceptance. Held/public runtimes unchanged; full original goal remains active.

2026-10-10 ordinary actor delivery continuation: held695cee4a now selects automatic same-cell multi-draw and conservative per-instance clipping, preserving exact original cell origins, source geometry/material and float32 matrices. Private fitted-rigid handgear pilot remains excluded.99 focused checks,12 integrated native checks/48 exact RGB controls and3 actual publication checks pass, including pooled-root return/disposal/fallback and supplied four-class High/Low jump/aura continuity. Modular candidate ordinary High265draw/176732triangles and Low149draw/79962triangles,16.7median16.8p95 pass original sampled budgets with actual Go-race fourteen-slot saved parties. Initial pairedHigh fully visible view failed required triangle-gain assertion; retained, no retry/relaxation. New actual equipped/HUD normal-input town-to-Earth-to-Verdant route completes with444post-login frames and49 grounded observations: town400draw and woodland468draw FAIL High350; road190 and approach145 pass, all four triangle/frame gates pass. Full route budget qualification fails before final party/save proof. Diagnostic attribution is now in progress; no whole-world/art/device/soak/beta/launch acceptance or public release. Source/modular and separate actual-bundle evidence remain explicitly distinct. Full original goal stays active. See default-actor-cell and actor-default-integration/publication/moving-route qualification receipts.

2026-10-10 follow-up attribution83a7c968 completes24untimed actual-render frames at ordinary town/woodland stops, all calls accounted/hooks restored. Different woodland550-556draw sample: original DemonOrc leaves225shadow+131-137color=356-362draws dominate; factory currently leaves DemonOrc unbatched and outside reviewed instance families. Town355-400draw sample includes27Respec/24Quest color,12Respec/18Quest shadow and29courtyard shadow. No further runtime selected. Later normalHigh party298draw/216290triangles/16.7median16.8p95 and actual Go-race four-class14slot saves pass only separate scope; native1pass1skip0retry. Original route town400/woodland468High350 failures remain. Frozen488-entry inventoryaef171c69669ff13cccba958f63050de45f8f158d259178757b049b1a7e34188, see town-woodland-submission qualification receipt. Next isolated DemonOrc constructor/pivot candidate must retain surfaces, PBR, animation/contact/reset/pool and native-shadow fallback, then original route budgets before selection. Full original goal active; public29 unchanged.

2026-10-10 reviewed DemonOrc/singleton continuation (progress): isolated DemonOrc7cf1373e/sourceaf0bfd0a preserves1202triangles, PBR/UV/normals, animation/gameplay metadata,20pose bounds and pooling;55raw→23packed meshes,167focused checks and latest16native poses/32surface controls pass. Corrected actual High398→241draw control passes visual thresholds; earlier missing-runtime-attachment failure retained. Combined singleton75a4403f/QA f8e994d0 passes105focused and12native checks including60singleton pose/shadow comparisons(13exact). All4High route stops pass original budgets(347/207/231/125draws), but later Highparty361draw FAIL350; Lowtown103102tri FAIL85000 and Low frozenwoodland83→90draw counterexample remain. Three distinct later normal Go-race four-class14slot parties/saves pass only sampled scopes, without erasing failures. Fixed60warmup+180frame Lowtown sample and12untimed renders confirm103110triangles/172draws/16.7median16.8p95 with workerpending0 and18selectedgeometry entries: failure persists after loading. Topcontributors Ilyra31289/camps19740/Fighter15219triangles; original immediate census was premature streaming, not steady attribution. Both candidates remain private/unselected; held695cee4a/public29 unchanged. Frozen DemonOrc822entries inventory f585334a2e688cdad8015c140119f8a85854749ad4bd53784a7d6522016a86a3; singleton891entries inventory c5445b130db8550c004f66d1ef365a62dfce197b2d5aba01032d5f190a776614. New qualification receipts and remaining register preserve original failures. Next isolate source-preserving camp instance clipping/reviewed NPC derivatives and unchanged whole-world budgets; exact candidate publication/art/devices/operations/F1–F5/beta/launch/handoff remain open. No campaign/soak replay or public push. Full original goal stays active.

2026-10-10 camp instance clipping continuation (progress): private1f87c0b7/QA9fe14c19 uses stock per-object color/shadow camera clipping for every15original camp/nine material buckets; native capability gates both world construction paths and unsupported/default factory retains original instancing. Source attributes/material hooks, deterministic transforms and every collider retained.52distinct focused checks pass after QA-only nonexistent-dispose failure retained;42exact native source/reference-again views cover all15placements/close/wide/edges/far origin.8replacement cycles return GPU counts to baseline;171552owned derivative bytes per field explicit. Actual frozen equipped/HUD town High347→338draw/229479→198283tri and Low172→163draw/103108→83368tri preserve exactRGB0. All8ordinary High/Low route profiles pass original gates: High338/167/239/118draws;Low163/91/118/56draws. Two real Go-race four-class14slot saved parties pass High282draw191390tri/Low149draw76853tri,16.7median16.8p95 both. Separate copied-bundle3startup checks plus2expanded visible camp checks pass, same engineSHA d058ed87d8f481329042a27530df589044fbe307d9456457040f7b53d6a46542; actual High18/Low9camp calls and9geometry/18texture disposals verified. Frozen986-entry inventory1ac5f899045562a3ac955d7956815af34eb9d53be4a9b18270717919dc369271, receipt2026-10-10-camp-instance-frustum-qualification.json. Combined candidate stays private/unselected, held695cee4a/public29 unchanged. Earlier Highparty361draw failure and Lowwoodland83→90draw counterexample remain retained; successful different populations do not causally erase them. Next actual equipped normal-input fight/first-dungeon moving review and representative dynamic population/device budgets; full world/art/contact/combat/operations/F1–F5/beta/launch/handoff remain open. No campaign/soak replay or public push. Original full goal active.

2026-10-10 equipped fight/first-dungeon continuation (progress): private QAca9e1c5b changes tests only, product runtime remains camp9fe14c19.41focused checks and native browser planner import/DOM check pass. Three retained High mixed180frame combat profiles pass median/p95 gates (301/259/238draw,16.7median;16.7/16.7/33.3p95),6actual kit kills; server accepts Charge/Whirlwind/ShieldSlam/IronFortress and audio calls occur with running context (not audibility/contact proof). Independent authored-road High/Low normallevel30Verdant entry, first-room movement and Recall pass; High115draw51121tri/Low57draw22463tri,16.7median/p95. Two real Go-race four-class14slot saved parties pass High325draw230068tri/Low182draw78735tri,16.7median16.8p95. Four overall failed sequences remain retained: basic-only death/cleanup-hook ownership, HUD-covered road click, unbound planner dependency and rock-blocked return from off-road combat. Corrected observer ownership/failure persistence and visible-prefix module loading are QA repairs, not gameplay fixes. Highcombat384draw peak and historical Highparty361draw/Lowwoodland83→90draw counterexamples remain; Lowcombat/combined off-road return/modern-art/device acceptance open. Frozen3230-entry inventory6decd5cc676542a770e5b8d10fd948fbf7d4cf7ee7b82453687919b7a46c59d6, receipt2026-10-10-equipped-fight-first-dungeon-qualification.json. Held695cee4a/public29 unchanged; requested motion/aura/admin fixes already accepted live. Next dynamic-peak attribution, collision-aware normal return, Lowcombat/devices and full original world/art/contact/combat/operations/F1–F5/beta/launch/handoff. No campaign/soak replay, runtime selection or public push. Full original goal active.

2026-10-10 status HUD continuation (progress): retained actual first-dungeon image exposed an emoji missing-glyph square/mostly-empty status tray. Independent HUD34c2ba82 selected as27bf88a8 on heldae675ba2; five product files byte-identical, no core/entities/world/server/assets/package changes and no camp/DemonOrc/singleton selection. Leaf SVG module covers all21tracked statuses with distinct font-independent paths and safe positive/negative fallbacks; phone headings share symbols, actual one-effect tray62px. Desktop keyed controls preserve focus through countdowns, show fresh clamped keyboard/hover tooltip, dismiss with Escape and remove expired tooltip.33focused checks pass; original4fail/29pass control retained.9native desktop/phone layout checks,1copied-private bundle status check,2exact selected held copied-bundle status/lazy-four-class checks,1actual saved-Fighter/four-class Go-race custody check pass;1optional peer-renderer skip remains skip. Actual native server-earned WellRested timer updates without button/focus loss,14equipped slots and live tooltip preserved; sampled private-context party296draw165530tri16.7median/p95 is not causal clearance of prior performance failures. Frozen58-entry inventory3f79342c055821903e571b2cd2c854dd8685eba9958966ac01048515aebc1107, receipt2026-10-10-status-hud-qualification.json; exact held bundlebea1f3019a0247b5db289a83b0d080dcd3b8fb8f50d843aa34516e4ef4276d12. No public push/version/access change; accepted public29 remains prior state. Next dynamic combat/party peak attribution, collision-aware off-road return, Lowcombat/devices and code-owned world/interior/material polish. Full original world/art/contact/combat/operations/F1–F5/beta/launch/handoff goal stays active, with no campaign/soak replay.

2026-10-11 status HUD CI continuation (progress): selected1625ac2e enrolls both desktop status cases in required interface CI;19BrowserSmokePlan checks pass and discovery verifies329cases with no omissions/duplicates. Discovery starts no browsers/servers/accounts and is not329execution passes. Five qualified HUD product files and all runtime inputs unchanged; no repeated native campaign, deployment/version/dependency/access change. Separate frozen CI addendum inventory 2f69e129eca2c9d7f9afe7243144293386f9d0d8b51d047232798067d7a2cdf4 preserves primary HUD inventory3f79342c055821903e571b2cd2c854dd8685eba9958966ac01048515aebc1107. Receipt2026-10-11-status-hud-ci-enrollment.json; full original goal stays active with performance/art/device/combat/operations/F1–F5/beta/launch/handoff open.

2026-10-11 collision-aware fight return continuation (progress): private QA846d63ed changes tests only, runtime remains prior camp/HUD context and unselected. Bounded detached planning checks full production collision/elevation and visible strict pointer prefixes; no actor/stat/camera/cooldown/server/geometry writes or jump fallback. Production foliage fixture reproduces the retained blocked chord; initial Node/jsdom URL and omitted-scenery fixture failures remain.30focused checks pass. High/Low combined normal kit fights, walking return, normal first-dungeon entry/movement, Recall and real four-class14slot Go-race saves pass;2native passes/2optional peer-renderer skips, retry0. Low normally walks to retained432.406616,245.255081origin and requires real detour, with7detour plans overall; High distinct route needed none.4kit kills; High96/Low176active frames of180mixed combat samples. High348draw173799tri/Low124draw33469tri16.7median/p95 pass unchanged sample gates, but High438peak/87frames over350 and party279698triangle peak remain; earlier361/384/Low83-to90 failures retained. Frozen1588-entry inventoryd950e6040a4a05d4e1af5b9f604653a537ade12ae2591865ecadf0924eb95041, receipt2026-10-11-collision-aware-fight-return-qualification.json. Held/public runtime unchanged this step; no campaign/soak replay or public push. Next controlled dynamic submission attribution, source-preserving performance, code-owned world/interior/material/contact polish and devices; full original operations/F1–F5/beta/launch/handoff goal remains active.

2026-10-11 additive-effect continuation (progress): independent runtime84f6d51b selected ascd92dc01 with CIca03de05 in held milestone; three owned MeshBasic factories use one pass only for filled additive faces, preserving wireframe brightness/ordinary alpha and every source component/timing/authority.87distinct focused checks pass;1560native High/Low corpus comparisons pass1549exactRGB, all reference-again exact. Original unrestricted policy failed60views per quality and is retained; no threshold waiver. Actual saved14slot Fighter normal server-accepted IronFortress same-scene316→283draw, maximumRGBdelta1; four-class Go-race custody passes.180frame party median341draw170314tri16.7median/p95 passes sampled medians, but284882startup triangle peak remains. Exact selected held copied-bundle policy/lazy-four-class2checks pass engineSHA58dfe04f1bb700ffef53ef5090b31ead63cafbdf0da5e42c89092fd5a8a59b4a;332CIcases discovered exactly once, not all executed. Separate180frame combat observer accounts for345peakdraw/120effectdraw from60meshes, but both instrumented encounters fail; no timing/balance/gameplay acceptance. Product/QA failure evidence frozen additive95entries inventory8f26a7d7115a0956ba041ee65104ef47706e57b70789640d42ebf3a9417cce8e; diagnostic907entries inventoryb98802ed63a0b6e757c9a689389203d07c80ef2ad4d174d621dd169d117237da. Private QA/loadout, camp/DemonOrc/singleton remain unselected; public29/requested jump/aura/admin acceptance unchanged. Next dynamic startup costs and coherent code-owned world/interior/material/contact polish; full original art/device/operations/F1–F5/beta/launch/handoff goal active. No campaign/soak replay or public push.

2026-10-11 dungeon-entry ward continuation (progress): previous goal turn made verified source/evidence progress. New c9e3b2ba/art, QA68e30c83 selected by exact fast-forward in held milestone: all five interiors replace floating torus/long threshold with pointed beveled masonry, metalwork and stable animated veil; three meshes1318triangles171220attribute bytes, zero textures/lights/colliders/targets.41current art/lifecycle+19CI plan checks pass; three unchanged authoritative-summary checks passed earlier. Metadata omission, mixed-corpus unsupported factory and uninitialized bundle-matrix baseline failures retained and corrected without weakening contracts. High/Low native20supported production layouts each/120state views/1440animation frames pass unchanged prepared draw/triangle bounds and collisions; separate default-CI Low20layouts pass with normal touch controls.335required cases discovered exactly once, not execution. Exact copied bundle ward lifecycle/lazy four-class2checks pass engineSHA62f538c037982250147e7896c225bf9cc10d3c2178463861887c7d59d2fe23d4. Actual normal saved14slot Fighter route/first-dungeon entry/movement/Recall and four-class Go-race saves pass in private d3ac269e camp/route-QA context; dungeon105draw53029tri16.7median/p95; party262draw216766tri16.7median33.3p95 but289302startup triangle peak retained. Frozen884-entry inventory1dbedb63909295971178334f9b9c8db63f02951bd54baa61d09fb72ce5734557, receipt2026-10-11-dungeon-entry-ward-qualification.json. No public push/version change or unrelated private renderer/QA selection; public29 motion/aura/admin acceptance remains. Narrow prepared views retain thin dark floor/shadow artifacts also in predecessor; next diagnose these and continue coherent code-owned world/interior/material/contact polish and representative dynamic budgets. Original full art/device/operations/F1–F5/beta/launch/handoff goal remains active; no campaign/soak replay.


2026-10-11 Verdant root/preset continuation (progress): previous goal turn revalidated/restated existing public29 fixes without new goal progress; this turn selected420a3cfa into held/world integration. Native isolation/ray/pixel probes show the thin floor strokes were decorative grave roots and bottom line the XP bar, not an established renderer fault. Curved, branched, partly buried roots retain two motifs/one batch per room, with smooth bark and no new textures/lights/colliders. High2880source triangles/380160merged bytes per room, Low864/114048; extra detail is explicit. Default Low caught real missing Verdant quality forwarding; fixed without relaxing assertions.72distinct focused checks pass; all20production layouts per High/Low,140views/1440frames including288camera-pan frames retain14slots, collision layout and original scene budgets. Prepared maxima High92draw117231tri/Low47draw37143tri are not timing/device/whole-world clearance. Exact copied bundle ward/ten-root/lazy-four-class2checks pass engineSHAe0760ffb4f0e9b8938ebcb8dfc6f4c7874874e9554b70492583278cb3c5a3009. Initial matrix-fixture failures, default-Low failure and superseded draft art remain retained; frozen580-entry inventory17eb49e3128525c87f28ef9405dce3d28948afd28a098a33e193123e47b58a36. Receipt2026-10-11-verdant-grave-roots-qualification.json. Public29 unchanged; no campaign/soak replay, unrelated renderer selection or public push. Next dungeon-floor repetition/broader scenery/material/contact/audio polish, dynamic438/361draw and289302triangle peaks and representative devices. Full original art/operations/F1–F5/beta/launch/handoff goal remains active.


2026-10-11 Verdant floor continuation (progress): selected ef70a3b4 privately; fitted irregular flagstones, lighter worn grout and continuous world-space weathering use existing PBR maps with no new geometry/textures/lights/colliders. One shader variant/two sine expressions per fragment, no GPU/FPS saving claim.70focused checks,7native checks pass/1optional peer-renderer skip;20production layouts per High/Low,168state/root views and1440animated frames including288camera pans, separate default Low20layouts and native far-origin partition/period controls pass. Exact copied bundle compiles actual floor shader and retains ward/ten roots/lazy four-class startup;336required CI cases discovered exactly once, not executed. Actual normal saved14slot Fighter authored-road first-dungeon movement/Recall and four-class Go-race saves pass in private unselected route context: dungeon105draw55079tri16.7median16.8p95; party285draw211709tri16.7median16.8p95 but281603startup triangles FAIL250000, prior289302triangle and438/361draw failures retained. Frozen851-entry/852-file evidence inventory12fb3e169976543bead0e390a76c71be0ce1bcd3af427db6a6e56171fc07ff72, receipt2026-10-11-verdant-floor-qualification.json. Public29 requested jump/aura/admin fixes remain accepted; source confirms aura sync after final interpolated/corrected jump placement. No campaign/soak replay, public push/version/access change or unrelated private renderer selection. Broader code-owned world/scenery/material/contact/audio, dynamic costs/devices and original operations/F1–F5/beta/launch/handoff remain open. Full original goal stays active.


2026-10-11 geometry preparation/CI continuation (progress): previous turn finalized/staged floor qualification; this turn selected cda30fd0/worker-order88e250af. Early120frame native renderer-boundary captures account for every triangle and identify large fitted outfit preparations waiting behind eyes/details. Largest pending source first with oldest every fourth dispatch preserves one in-flight job, copy/source budgets, stale handling, worker algorithms/cache and all geometry/quality.139distinct focused checks pass; copied actual bundle High/Low four-class14slot controls retain65/71exact prepared index buffers and identical pixel hashes, with worker offline/reentry/exception fallback;8distinct native correctness checks pass/1optional skip. Actual normal first-dungeon entry/movement/Recall and four-class Go-race saves pass: dungeon104draw57197tri16.7median16.8p95. New separate party300draw168340tri has33.3msmedian FAIL20 and50p95 FAIL33.4,35–36entities versus earlier28–31; instrumented early386370triangles also retains startup failure, timing there invalid. No causal FPS gain or clearance of earlier281603/289302triangle/438/361draw failures. Actual software probe retains High180sec timeout (combined4pass1fail); both exact outfit cases pass SwiftShader. Three full dungeon reviews move intact to unconditional mandatory native predeploy;335hosted discovery exactly once plus5native,338prior required identities all retained with two intentional backend repeats. No quality/frame/threshold reduction or skipped pass. Frozen initial604-entry inventory12f54909a762f5e50e5a4277009334eef89303a1083a100a3a8516f81163d5a3; final677-entry inventory6b575577492117a869e5eaf3071b5d908653417056591c9204d7e2b5547e804c; receipt2026-10-11-geometry-preparation-priority-qualification.json. Public29 unchanged, private camp/singleton/DemonOrc/route QA unselected. Next actual CPU/population/startup preparation attribution plus cohesive world/scenery/material/contact/audio/devices; original operations/F1–F5/beta/launch/handoff remain open. No campaign/soak replay, public push/version/access change. Full original goal stays active.


2026-10-11 CPU attribution continuation (diagnostic progress): existing post-timing3s sampler on unchanged private7890349e identifies scene matrix propagation/composition, scene projection/frustum checks and shadow traversal; no runtime edits or speculative optimization selected. Ordinary180frame High sample269draw169766median triangles passes geometry limits, but49.9msmedian/66.6msp95 FAIL20/33.4. One native browser pass/one optional four-browser skip and four-class fourteen-slot Go-race saves pass. Population30–31 differs from prior35–36; recorded shared-host load21.76/16CPUs cannot establish a cause or waive failures. Foliage2386visits/frame with unchanged view/light; actor light traversal82322sample-weighted microseconds. Preserve stock matrix-force semantics and live light discovery; prior listener/world-box prototypes remain rejected, existing matrix-owner diagnostic available for concrete future hypothesis. Frozen22-entry inventory1d08fe52a19a63e50c0e9e85fffbb190bd362170cb0a872338d2963f377d0605, source pins and credential-safe report retained; receipt2026-10-11-party-cpu-attribution.json. No fresh dungeon route/campaign/soak replay, public push/version/access change or unrelated private source selection. Public29 requested jump/aura/admin fixes already accepted; full original world/art/contact/audio/device/performance/operations/F1–F5/beta/launch/handoff goal remains active.


2026-10-11 elemental floor continuation (progress): selected75a37d88 privately for Molten, Tempest, Abyssal and Umbral. Mineral albedo improves stone readability under existing regional lights; stationary world-space color/roughness weathering crosses repeated tiles and mesh partitions.56 wall/floor noncolor map pins unchanged; no new textures, geometry, lights, colliders or passes. Four shader variants/two sine evaluations per floor fragment add shading work; no FPS saving claim.86 distinct focused and14 distinct native cases pass cumulatively; all initial sRGB/readback/worker-observer/loop-pose/empty-baseline failures retained.16 prepared equipped desktop/phone views,32 paired screenshots,288 actual animation frames, far-origin partition controls and actual copied engine820000040a39b988 pass scoped checks. Exact warmed resource baseline after each of4 cleared rooms; renderer first-use allocation recorded.337 hosted discovery exactlyonce plus15 mandatorynative covers348 distinct cases, all338 prior identities retained; discovery is not execution. Frozen297-entry inventorydf7a284a8a24befdb864997ec573a82a0a1d0013b6c9d467ee891773c15b5fa8; receipt2026-10-11-elemental-floor-material-qualification.json. Public29 motion/aura/admin unchanged; staged unpublished with no new server route, timing, physical-device or full-art acceptance. Existing performance failures, sparse room composition, broader world/scenery/contact/audio/devices and original operations/F1–F5/beta/launch/handoff remain open. No campaign/soak replay or version/access change. Full original goal stays active.
