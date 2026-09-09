# Well Rested — active implementation contract

Unreleased development branch after staged1.0.57. This document does not mark
the feature or a release complete. Server/client/aura/live acceptance must all
finish before publishing it under its own version.

Use an authoritative scene-scoped safe-zone registry, initially Lanternhold's
inclusive visible fence rectangle (X−100..100, Z100..300), shared by rest,
recovery, hazard protection, PvE and open-world PvP. Future zones register through
the same API. Dungeon coordinates never inherit overworld safety accidentally.

Connected living players earn one rest second per elapsed second inside a safe
zone, up to7200. Dead players do not earn rest; being inside still pauses expiry.
Outside, connected players spend elapsed duration even when dead. Disconnected/
logged-out players neither earn nor spend it. Persist fractional seconds in the
full character/journal snapshot; malformed or unknown saved versions fail closed.
Safe zones restore10% of the final maximum HP/MP each second, with fractional
resource carry and no passive-regeneration stacking. Corpses never regenerate.

## Stat map and arithmetic

Apply the modifier once after un-rested base/equipment/gem/set/resonance/talent
and active-status recalculation. Do not feed boosted attributes back into the
same derived calculation or modify saved base stats/equipment.

- Strength, Dexterity, Intelligence, Wisdom, Vitality, maximum HP/MP, displayed
  basic damage and defense: multiply by1.10, floor only at integer boundaries.
- Movement speed, casting speed and HP/MP regeneration rates: multiply by1.10.
  The existing permanent-stat movement cap is applied first; rest is a temporary
  speed modifier like the existing haste buffs, not a new permanent-cap formula.
- Attack throughput increases10%: divide seconds-per-attack by1.10 and update
  the authoritative attack cooldown. Existing base caps apply before temporary
  haste modifiers, as they already do for Zeal/Time Warp.
- Cooldown reduction receives a relative10% increase, retaining the existing
  50% ordinary/80% Time Warp bounds. Do not shorten already-running cooldowns.
- Fire/poison/holy damage, healing-done, lifesteal and resistance bonuses receive
  a relative10% increase (not ten percentage points). Crit chance is scaled once
  after equipment and applicable talents combine, retaining its100% probability
  cap. Skill-specific fixed mechanics/ranks are not independently multiplied.
- Levels, currencies, XP already earned, allocation points, item potency/ranks,
  visual size, attack reach and buff/debuff durations are not character stats.

Expiry/recalculation must never refill resources. Clamp values that exceed a
reduced maximum on expiry, retaining zero mana/death. Integer presentation rounds
down consistently with the existing combat-stat representation; no repeated
application may compound the modifier.

Apply the25% enemy-kill XP bonus after ordinary solo/party/difficulty/resonance
calculation for the recipient, before existing max-level conversion. Do not
multiply gold, manual quest turn-ins, investigation or room-clear payouts.

Implemented locally: replicated local/remote status and remaining duration,
desktop/phone buff text distinguishing accumulation, cap and outside countdown,
an Eidolon-specific golden/elemental mote halo using the existing High/Low status
effect lifecycle, and expiry/death/respawn disposal. The aura is hidden during
stealth so a cosmetic does not reveal a hidden Rogue. Network clients do not
award time or modify authoritative stats. Existing town-based persistence tests
must account for the newly requested recovery instead of disabling it to retain
old no-town-healing expectations. Real-input rested/unrested pacing, reconnect,
four-class stats and device/aura acceptance remain required.

## Development acceptance — September 8, 23:30 UTC

Latest additional acceptance, **September9 01:56UTC**:

- Two actual party members, normal registration/invitation/acceptance and native
  joystick movement: final browser68967 **PASS1/13.4s**. Both local and remote
  rested auras follow the correct actors with transparent non-box geometry.
  Normal graphics-menu changes yield19 visible parts per actor at High and10
  at Low; Low intentionally retains reusable cached geometry while hiding extras.
  Status text and aura checks cover390×844,844×390,568×320. Small landscape uses
  a scrollable status body. This proves two-player rendering, not full-raid load
  or physical iOS/Android performance.
- Final route waits for the hero to align with the layout-owned clear encounter
  region between phone controls, not the geometric screen center. Separate
  open-panel/world screenshots retained in `/tmp/eidolon-rest-party-final-CBdw9R`
  and visually inspected. Evidence `/tmp/eidolon-rest-party-0158.log`, final lint
  passes (`/tmp/eidolon-rest-party-final-lint.log`), credential scan passes;
  all owned local handles terminal and test projects removed/absent.
- Prior0149/0151 failures were test assumptions about an already-closed Resume
  menu and allocated-versus-visible mesh counts.0153 passed10.9s;0155's additional
  camera check incorrectly expected viewport centering. Final0158 uses the
  explicit existing phone encounter-region contract. No production changes.
  Native buff expiry and the failed full collection/earned balance gate remain
  open; do not mark Well Rested versioned, staged or live.

Latest additional acceptance, **September9 01:40UTC**:

- Phone talent-economy actual31044 **PASS1/14.4s**. Actual normal touch rank
  purchases reduce Fireball30→21 and skill cooldown, including fresh login in
  landscape. New read-only complete resource observations require the explicit
  owned loopback server and fresh server timestamps. Exact earned-bank delta,
  stable capacity and sanctuary identity bound intervening recovery; no inflated
  wall-clock or ordinary-regen allowance. All three actual casts started naturally
  full and therefore proved exact payment1853→1823/1832, without a full-bar wait.
  Evidence `/tmp/eidolon-rest-talent-0137.log`; credential scan passed, owned
  containers/data removed and absent.
- Death/recovery actual92590 **PASS1/24.8s**. Living fresh login restored80→86
  mana using only0.5343 earned seconds across3.108s wall time. Hostile death with
  expired bank retained0HP/70MP across3.497s login. Dead Respawn reached full
  resources; living Recall used only timed town mana recovery. Final depleted
  login73→79 used0.5703 earned seconds across3.370s wall time. Existing allowlisted
  near-death/encounter fixture is retained; ordinary casts, hostile death, death
  button and Recall are unchanged. `/tmp/eidolon-rest-recovery-0143.log`; owned
  project/data removed and absent, credential scan passed.
- Independent recovery bounds account for at most one whole point discarded
  by the two fractional segments across one disconnect, not arbitrary refill
  tolerance. Focused arithmetic **23 tests PASS0.803s**. Added a null-frame guard
  to the observer for control messages arriving before any fresh state.
- Fresh-opening baseline now expects the unchanged .01 per-stat regeneration
  with exactly1.10 modifier while the authoritative rest bank is active. Its
  actual no-grant opening/collection47973 is running. Full client/lint88014 is
  terminal: **242 suites/3,440 tests PASS153.658s**, lint passes. Logs
  `/tmp/eidolon-rest-recovery-client-full.log` and
  `/tmp/eidolon-rest-recovery-lint.log`.
- Fresh collection47973 is terminal **FAIL6.4m**. Opening completed normally
  in62s with3 kills,0 deaths and manual500XP/100gold reward. Collection reached
  12 observed deaths,3/8 fragments,level6,0 player deaths, then failed the existing
  120-second encounter deadline after prolonged low-mana retreat/reacquisition.
  Retained8-item requirement/drop rate/death bound/timeout. No production change
  or fabricated progression. Evidence `/tmp/eidolon-rest-fresh-0146.log`, retained
  sanitized artifacts `/tmp/eidolon-rest-fresh-failure-Q1oxlk`; owned project/data
  removed and checked absent. This is an open earned-play gate, not a pass.
  Investigate the ordinary resource-management route and defensive input behavior;
  using the requested town recovery between encounters is a relevant player
  workflow to verify, but has not yet been implemented/tested in this route.
  No production rules changed; integrated expiry/group/phone aura and broader
  rested/unrested progression remain open.

Latest additional acceptance, **September9 01:24UTC**:

- Actual schema7→8→9 upgrade/refusal/recovery passes12.916s. Uses exact bridge
  9aec835 and resource7ab559 binaries for prior-version behavior, then d650c72
  for Well Rested. Keeps the legacy level31 intelligence-chest fixture, real
  Fireball/Fireball/Shield depletion to zero mana, two25-gold listing deposits,
  rejected escrow save and actual schema8 process crash. The schema7 writer
  refuses schema8; after migration the schema8 writer refuses schema9. Both
  refusals occur before admission/writes; raw user BSON, journal and pending
  operation remain unchanged. Two fresh schema9 processes recover listings,
  exact resources and rest, then ordinary town login heals only online time.
  This tests the actual upcoming8→9 boundary without disabling town recovery
  or fabricating a zero-mana state in the new server.
- Read-only raw observations before stopping old writers avoid running current
  migrations too early. The integration additionally requires absolute
  `EIDOLON_RESOURCE_PRE_REST_BINARY`, alongside existing bridge/current binary
  and disposable loopback/failpoint opt-ins. No production database involved.
  All four server logs are free of race/panic/fatal failures; schema8 kill was
  intentional, bridge disconnect save verified before legacy shutdown, both
  schema9 processes completed normal drains. Owned Mongo0122/volume removed
  and absent. Evidence `/tmp/eidolon-rest-schema-0122.log`.
- Full server-package race sweep passes13.222s; focused independent recovery
  oracle tests pass. `/tmp/eidolon-rest-schema-root.log`. Production unchanged.
- Added an isolated real-input browser route (`EIDOLON_ISOLATED_QA_ROUTE=well-rested`)
  for fresh registration, earned rest, ordinary travel, an enemy hit, Recall
  and fresh login with aura/timer checks. Final actual17880 passes1/32.3s:
  bank5.346s in town,12.574s after crossing out,9.738s after combat/Recall,
  12.099s after fresh login.19 aura meshes remained attached; cast reduced
  mana110→80, actual local damage receipt hit the selected enemy, and town
  recovery raised mana93→110 across the return/relogin interval. This is a
  functional travel/combat/reconnect check, not exact XP or first-hour balance.
  Evidence `/tmp/eidolon-rest-browser-0131.log`; artifact credential scan passed,
  owned containers/volumes/image removed and container absence checked.
  Town/relogin screenshots retained in `/tmp/eidolon-rest-browser-proof-nXFcKk`
  and visually inspected; original transparent gold rings/motes, no opaque box.
  Full lint passes (`/tmp/eidolon-rest-schema-browser-lint.log`).
- Initial browser0126/0128 attempts failed their health-only target check.
  The final route establishes ordinary target selection/chase, requires a local
  server damage receipt and recognizes authoritative DEAD state (the renderer
  does not refresh its live HP field on a death snapshot). Prior attempts lack
  post-cast state evidence, so do not claim a definitive individual cause.
  Final hit had an observed HP reduction30→28 as well as the damage receipt.
- Group/phone aura, expiry and rested/unrested earned pacing still need evidence.
  Source audit also identified old browser assumptions in fresh-opening's exact
  .1 stat regen, death-resource-recovery's town login/Recall bounds and phone
  talent-economy's castResourceBounds. Adapt those to explicit authoritative
  rest/safe-zone state; do not disable recovery or inflate unexplained allowances.

Latest additional acceptance, **September9 01:16UTC**:

- Actual standalone refunds/refund lifecycle pass43.100s: offline pending
  corpse snapshots, outbid recipient save and refund-acknowledgement failures,
  bounded100-refund backlog recovery, and unreadable-auction startup refusal.
  Exact saved bank/resources survive offline work; connected healing is derived
  independently from earned rest time. Original gold/receipt/equipment and
  failure/retry bounds remain enforced.16 normal child processes drained cleanly;
  the separate deliberately malformed-record process refused startup as expected.
  Owned Mongo0102 and its volume were removed and checked absent. Evidence:
  `/tmp/eidolon-rest-refunds-0102.log`.
- Original actual live-handoff/cooldown flow now passes8.066s, preserving a real
  Fireball, two repeated joins, overlapping authenticated login, late old-socket
  cleanup, new-owner commands and fresh disconnect persistence. The level1
  vitality-chest fixture has an independent exact pool/recovery oracle.
  Two initial test-assumption failures are retained in0107/0115 logs: a cast can
  precede the first rest tick, and disconnect intentionally clears transient
  fractional healing. The final check validates exact old-session recovery at
  the handoff's fresh durable save, then exact new-session recovery from there;
  no production rules or cooldown checks were weakened. Final evidence:
  `/tmp/eidolon-rest-handoff-0119.log`. All three processes drained cleanly;
  their owned Mongo containers/volumes were removed and checked absent.
- Final full server-package race suite passes12.590s; evidence
  `/tmp/eidolon-rest-refund-handoff-final-root.log`. All owned handles closed.
  Production server source remains unchanged from the exercised d650c72 binary.
  Schema-upgrade recovery, integrated browser travel/reconnect/group aura and
  rested/unrested earned-play pacing remain open. Feature is still unversioned
  and not live.

Latest additional acceptance, **September9 00:57UTC**:

- Full merged client66914 **PASS242 suites/3,425 tests93.429s**, lint also passes.
  Logs `/tmp/eidolon-rested-merged-{client,lint}.log`; handle closed. Client source
  unchanged during this sweep; subsequent work below changes only Go tests/docs.
- Bid crash recovery now checks the new bidder's exact durable resource/rest
  snapshot before each fresh login and the displaced bidder's unchanged offline
  resources alongside the43-gold refund. Ordinary real Fireball, debit/refund
  receipt identities, rejected decisions and final auction marker remain intact.
  Actual79841 **PASS54.506s**, all6 boundaries;18 child logs clean,12 normal
  drains/6 explicit kills. Owned Mongo0053/volumes removed and absent. Evidence
  `/tmp/eidolon-rest-bid-0053.log`.
- Ordinary same-bidder raises and simultaneous equal bids retain exactly one
  accepted winner and exact signed receipt counts, checking each participant's
  online-only recovery and exact pre-login restart resources/rest.
- Buyout tests preserve original inventory/equipment/progression and exact
  purchase/43-gold refund effects separately from the current session's resource
  baseline. Covers normal/same-bidder/stash/full/insufficient/disabled cases,
  six real crash boundaries with database/journal replay, duplicate requests,
  one item receipt, offline previous-bidder preservation and two simultaneous
  purchases with exactly one winner. No production rules or faults were weakened.
- Combined4784 **PASS105.677s**: bid raises/contention14.40s, normal/capacity
  buyout38.49s, crash44.46s, competing buyout7.31s.36 child logs independently
  clean,30 normal drains and6 explicit kills; owned Mongo0056/volumes removed and
  absent. Evidence `/tmp/eidolon-rest-purchase-0056.log`. Root race61394
  **PASS12.077s**. Production binary remains exactd650c72, unchanged server code.

Source audit still finds old no-town-healing assumptions in standalone refund/
refund-lifecycle integrations and the original live-handoff/cooldown fixture
(distinct from the already-passing dedicated Well Rested socket-handoff test).
These, schema-upgrade recovery, integrated browser/aura and earned balance
remain open. Do not label the feature staged/live or its acceptance complete.

Latest additional acceptance, **September9 00:49UTC**:

- Listing acknowledgement/rejection and restart tests now retain exact timed
  town recovery and actual Fireball cost. Original item metadata/legacy scaling,
  stack/selection/bound-item/full deposit checks remain intact. Seven actual
  crash boundaries compare the durable database or uncommitted journal to both
  fresh-process restores before login. Rejected preflight preserves the older
  database; its journal retains the unsaved cast and new rest/resources.
- Delayed-publication test still ages only the prepared auction decision after
  the real request/escrow/crash. Recovery preserves rest/resources, immutable
  listing identity and the full paid publication window without extending it
  again on the next restart.
- Listing54724 **PASS92.422s**:9 normal/rejection cases44.39s,7 crash cases41.41s,
  delayed publication5.61s. `/tmp/eidolon-rest-listing-0044.log` lists42 child
  directories, all checked clean;34 normal drains and8 explicit expected kills.
  Owned Mongo `eidolon-rest-listing-20260909-0044`/volumes removed and absent.
- Item delivery retains exact earned item metadata, including Forge basis,
  one-copy/receipt counts, original gold/equipment/progression, buyer/seller claim
  state, stash fallback and full-storage rejection. Five ordinary/capacity cases
  and six crash boundaries verify online-only recovery and exact saved bank/bars
  before each fresh login; a delivery journal cannot separate item from resources.
- Initial78268 **PASS69.162s** (capacity28.91s/crash39.23s);28 logs clean,22 normal
  drains and6 intentional kills. Added an explicit original-gold/equipment/
  progression comparison at startup, separate from the recovered resource baseline.
  Final crash91858 **PASS40.684s**;18 logs clean,12 normal drains/6 expected kills.
  Evidence `/tmp/eidolon-rest-item-0047.log` and
  `/tmp/eidolon-rest-item-final-0048.log`; both owned Mongo projects/volumes removed
  and checked absent. Final root race76334 **PASS11.365s**.

Runtime remainsd650c72 server code; all changes here are test/docs. Merged client
now includes50's attack-to-walk fix. Its full client/lint sweep66914 is running
(`/tmp/eidolon-rested-merged-{client,lint}.log`); do not edit client/runtime while
active. Still required: bid/contention/refund and buyout recovery, schema upgrade,
integrated browser/aura and earned rested/unrested balance. Not staged/live.

Latest additional acceptance, **September9 00:35UTC**:

- Adapted seller-payout normal acknowledgement/retry and six actual crash
  boundaries to retain requested town healing/rest. Independent arithmetic
  checks each durable snapshot against online rest-bank delta and actual30-mana
  Fireball; no capped pre-cast regeneration may invalidate that calculation.
  Exact gold, receipt counts, seller claim, outstanding buyer item, escrow,
  equipment/inventory and progression assertions remain separate and unchanged.
- Before each crash, inspect the database plus any uncommitted character journal.
  Both fresh-process recoveries must retain exactly that durable health/mana/rest
  before login; only subsequent connected town time may add recovery. Faults
  remain decision rejection/lost reply, before credit, credit journal, before
  finalize and lost final reply. No failure fixture touches shared/live data.
- Actual55487 **PASS55.267s** (normal7.95s, six crash boundaries46.29s).
  `/tmp/eidolon-rest-payout-0033.log` lists20 child directories: all independently
  checked clean,14 normal drains and6 explicitly intentional kills. Owned
  Mongo `eidolon-rest-payout-20260909-0033`/volumes removed and absent.
- Retained the original normal-session locked-skill check after the real cast
  using the same exact arithmetic with the known mana cost. Final normal
  follow-up9286 **PASS8.357s**; two logs clean with normal drains; owned Mongo
  `eidolon-rest-payout-probe-20260909-0034`/volumes removed and absent. Evidence
  `/tmp/eidolon-rest-payout-probe-0034.log`. Production binary remainsd650c72.

Other auction flows (listing, bids/contention, buyout and item delivery), schema
upgrade, integrated browser/aura and earned rested/unrested balance remain open.

Latest additional acceptance, **September9 00:27UTC**:

- Actual PvP8-case matrix now covers four classes in ordinary consent duels,
  1v1/2v2 queue/party flows, repeated Join, forfeit, shutdown and fresh login.
  Disconnect routes consume their town bank to zero before exact cast/resource
  checks; shutdown routes retain a prepared60-second bank and verify outside
  consumption and buffed current-maxima recovery. Existing rating/win/loss/honor/
  season-point exact-once checks remain unchanged. Town return and fresh login
  use independent timed recovery arithmetic, not disabled healing.
- Initial20960 failed79.651s only in the active-bank shutdown cases: the scene
  admission snapshot precedes the first world rest tick and still carries the
  old town label. Expiry/forfeit cases passed. Corrected synchronization waits
  for the actual empty safe-zone label under the same20s limit; runtime unchanged.
- Actual rejected-Mongo-save recovery retains real Fireball cost, exact town
  bank/resources in the journal, exact full snapshot replay before readiness,
  and later ordinary login/save. Already-committed journal replay additionally
  retains a dead character's123.456789 bank without losing later gold credit.
- Corrected1639 **PASS91.871s**: rejected-save5.39s, committed-replay2.60s,
  PvP82.86s/all8 cases. Exact production race binary remainsd650c72, unchanged
  runtime. Log `/tmp/eidolon-rest-workflows-0025.log` lists all19 child evidence
  directories; independently checked clean of races/panics with normal drains.
  Owned Mongo `eidolon-rest-workflows-20260909-0025`/volumes removed and absent;
  the earlier failed run's Mongo `eidolon-rest-pvp-20260909-0030` is also absent.

Still open: auction failpoint and schema-upgrade integrations, browser-integrated
travel/reconnect/aura and earned rested/unrested balance. Not staged or live.

Latest additional acceptance, **September9 00:12UTC**:

- Existing four-class dungeon restart/recovery matrix now distinguishes bounded
  legitimate town healing during portal admission from exact no-passive-regeneration
  bars inside these zero-Vitality/Wisdom fixtures. It waits in real server time
  for the small town-earned bank to expire, checks exact lower maxima and no
  dungeon healing, then verifies actual Fireball cost and disconnect resources.
  Same-seed/layout and explicit partial-room/death fixtures still survive fresh
  processes without duplicate rewards; normal Recall/Respawn back to town uses
  exact rest-delta recovery. Known journal-chest fixture maxima145/445 and159/489
  have their own guarded independent arithmetic test; no arbitrary equipment
  builds are silently accepted by this oracle.
- Actual**67378 PASS52.653s**, all8 class/living/dead cases and16 fresh server
  processes, exact production race binaryd650c72. Every child log independently
  checked clean with a normal drain:2188294785,2461958979,2947461422,4043686394,
  3688029872,607370852,106456909,2650884940,54121508,2733231826,3839608658,
  3858867010,3319377111,2512730731,3591180787,217045687. Owned Mongo
  `eidolon-rest-dungeon-20260909-0010`/volumes removed and checked absent.
  Log `/tmp/eidolon-rest-dungeon.log`; focused arithmetic/compile77101 PASS1.053s.
- Offline scope resolved by inspecting actual entry code: src/main.js sets
  isMultiplayer=true; GameEngine unconditionally keeps both engine and actor
  multiplayer. The released game has no offline-play entry. Keep server-owned
  rest and resources; disconnected time neither earns nor spends the bank.
  Gallery/offline actor simulations are previews, not a separate character
  progression mode. Added actual Actor.update regression across four bank/zone
  states:60 simulated render seconds cannot earn/spend rest or heal multiplayer
  actors absent authoritative snapshots. Client96687 PASS2suites/15tests1.01s.

All local check handles closed. Still open: PvP integration adaptation,
journal/auction/schema-upgrade flows, browser-integrated presentation and earned
balance. No runtime, metadata or deployment changes in this checkpoint.

Latest additional acceptance, **September9 00:02UTC**:

- Adapted existing token-resume/death-recovery and eight-live-socket shutdown
  tests while keeping town placement, token replay rejection, dead Recall
  rejection, normal Respawn, and an actual Wizard Fireball. Living Recall is
  checked against only earned town recovery, not an unconditional mana refill.
- New independent level30 fixture arithmetic derives exact integer HP/MP from
  saved bank delta and known un-rested145/245 (rested159/269) maxima. The cast
  path accounts for its30 mana cost and enforces that the prepared character
  did not already cap before casting, so no discarded regeneration is hidden.
  Shutdown and fresh-process saved bars remain exact, including corpse zeros.
- Rejected-ability mana replies are bounded by two independently validated
  state frames, not a stale pre-healing bar. A loopback-only timestamp filter
  discards state queued before the action acknowledgement. No production
  protocol or gameplay changed for these tests.
- Actual**25653 PASS47.589s**: recovery24.78s(all8 alive/dead class cases),
  shutdown/restart21.78s. Exact d650c72 production race binary. Logs1466942589,
  3161073359,1082969551 independently clean with normal drains. Owned Mongo
  `eidolon-rest-recovery-20260908-2359` and volumes removed/checked absent.
  Evidence `/tmp/eidolon-rest-recovery.log`.
- New four-class arena/forfeit unit regression verifies that banks expire
  outside sanctuary, match restoration uses current maxima rather than stale
  boosted stats, and returning to town reactivates once without instant refill.
  Focused server/race87427 PASS(root1.421s/game1.910s).
- Full server-package race26178 PASS11.608s; independent fixture-arithmetic
  unit32917 PASS1.017s. The arithmetic helper explicitly rejects other levels,
  Vitality/Wisdom/Intelligence values or equipped builds instead of silently
  applying these fixture maxima elsewhere. All owned local check handles closed.

Still open: older dungeon/PvP resource integrations, journal/auction failure
flows and schema-upgrade expectations, browser-integrated travel/reconnect/scene
effects and earned balance. The full lifecycle gate is not declared complete.

Latest additional acceptance, **September8 23:51UTC**:

- Adapted the existing144-session resource matrix without moving characters
  out of town or suppressing recovery. Expected integer HP/MP now use the exact
  newly persisted rest-time delta, independent known fixture maxima, fractional
  truncation and caps. Reject pre-login/offline time, corpse accrual, unexpected
  refills, permanent boosted base stats, changed equipment/gold/level. Each next
  fresh process starts from the preceding exact save. **50838 PASS150.264s**,
  all144 sessions, four classes/three levels/three processes. Logs854628412,
  3602368113 and2500519429 independently clean with normal drains. Owned Mongo
  `eidolon-rest-resource-matrix-20260908-2346` and volumes removed/absent.
- New real-disconnect/token-resume/authenticated live-handoff test **27724
  PASS7.468s**. A1.5s actual disconnected interval earns/spends/heals nothing;
  rotated token restores bank and exact bars from online time only; replacing
  an active connection does not rewind/double bank credit. Log4181622292 clean
  with normal drain; owned Mongo2350/volumes removed/absent.
- New real north-gate network movement **54493 PASS9.298s**. Prepared save begins
  at(0,100.25); subsequent quarter-unit movements use ordinary server-issued
  context and sequence acknowledgements. Inclusive Z100 remains safe; Z99.75
  spends bank and stops max-pool healing; living expiry removes the stat bonus;
  return reactivates it once and resumes exact recovery. No warp/QA mutation,
  disabled enemies, combat immunity or accelerated time. This is actual server
  movement-protocol acceptance, not browser pointer/joystick or earned combat
  acceptance. Log1447624681 clean with normal drain; owned Mongo2353/volumes
  removed/absent.

These tests used the already verified exact production race binaryd650c72; no
production behavior changed this turn. Logs `/tmp/eidolon-rest-resource-matrix.log`,
`/tmp/eidolon-rest-resume.log`, `/tmp/eidolon-rest-boundary.log`. All owned local
handles are closed. Remaining older resource tests still include pre-rest town
assumptions (cast/Recall/Respawn, shutdown, journal/auction and schema upgrade);
do not call the whole persistence gate adapted yet. Browser-integrated travel/
reconnect/scene visuals and earned rested/unrested balance remain open.

- Focused server/race protocol/reward tests passed (root1.438s/game3.929s);
  kill-only party rewards and level100 resonance conversion retain quest/gold
  exclusions. Generated JavaScript protobuf contract:12 tests passed.
- Full Go race suite76164 passed: root16.905s, game266.589s; no failure/restart.
- Full Jest44598 passed242 suites/3415tests121.714s; lint69906 passed.
- Presentation32110 passed61 tests including lifecycle/transparent hitbox,
  High/Low, stealth, explicit expiry and keyed phone timer/state updates.
- Hardware Chrome gallery81816 failed before startup because this new worktree
  had no prepared vendor runtime. Ran the existing prepare:client script;
  corrected52814 passed1/7.8s across all attached statuses, High/local and
  Low/remote. Screenshot inspected: golden small motes/foot rings, no box.
  Evidence: /tmp/eidolon-well-rested-gallery-prepared/animation-gallery-determin-667e3-e-actors-in-hardware-Chrome/procedural-status-well_rested.png.
- New opt-in real-session/restart test compiles; default run skips the external
  process test. It has NOT yet supplied actual-session acceptance.

Actual af7ed63/78308 FAILED43.834s: all four-class arithmetic checks passed,
but the capped player's full-recovery wait exceeded20s. Evidence
`/tmp/eidolon-compat-session-523788755/server.log` has no race/panic and a clean
shutdown drain; owned Mongo2332/volumes removed and independently absent.
The production loop passed a fixed0.033 to recovery despite slow race-instrumented
frames. Fixed rest/recovery to use a per-actor monotonic elapsed clock via
UpdateRealtime while preserving the fixed physics/combat step. Newly admitted
actors do not inherit time from before login; disconnect/resume resets the clock.
Simulated Update(dt) remains deterministic for unit probes. Corrected actual
session acceptance is still pending; do not weaken the full-recovery deadline.

Corrected **d650c72/61870 PASS31.984s** on a fresh owned Mongo: four-class
real-time HP/MP arithmetic, capped7200 bank with recovery to full within the
unchanged20s wait, safe-zone corpse pause, outside corpse expiry with stat reset,
ordinary saves preserving fractional time/unboosted base stats, and a fresh
process restoring exact123.456789 bank/zero HP/zero MP/death. No accelerated time
or altered gameplay allowances. Evidence logs2749074430 and101665801 both clean
with normal character shutdown drains. Mongo2337/volumes removed and independently
absent. Exact race binary:
`/tmp/eidolon-well-rested-clock-proof-q57aue/d650c72b2013434d393a350fb2197be25874ba25`.
Log `/tmp/eidolon-well-rested-actual-clock-session.log`.

Elapsed-clock focused server70080 passed(root1.448s/game3.341s). Desktop/phone
rendered69181 passed3/8.0s, but screenshot inspection caught a vertically wrapped
Buff label beside the long timer. The phone row now gives named bank timers their
own full-width line below the title. Corrected47419 passed6/15.1s including the
existing compact-status layouts; portrait390x844 and short568x320 screenshots
inspected. Evidence `/tmp/eidolon-well-rested-ui-readable`; the short sheet scrolls
for the detailed explanation while preserving readable title/timer and controls.

Final regression12580 PASS: full Go race root14.545s/game238.808s, unchanged
database/lifecycle packages cached. Final lint26098 PASS. Final targeted client
24492 PASS3suites/18tests1.397s (the requested Minimap.test.js pattern matches no
file; actual desktop minimap coverage is the rendered test above). Functional
development HEAD2d19834; all local check handles closed. Full user/roadmap goal
remains open and the feature is not published.

Not a staged release: inherited1.0.57 metadata is unchanged and this branch must
not be published as57. Schema9 protects saved rest state from schema8 full-save
writers. Required before versioning: real sessions, existing resource acceptance
adaptation, offline behavior/parity decision and implementation, boundary travel,
phone rendered readability, scene lifecycle and final balance/gameplay checks.
