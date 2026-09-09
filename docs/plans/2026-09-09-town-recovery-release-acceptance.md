# Town recovery release acceptance — Alpha 1.0.58

Latest September9 07:56UTC: candidate **f6f420d6f5f3f03665c075042160e20c1c2acf07**
remains UNPUBLISHED. Complete58 run65093 failed movement's unchanged one-unit
render-step bound (1.056 observed), after earlier combat/phone/resource routes
passed. No failing-frame attachment existed in that older test, so the cause
remains unproven. Retained log/archive and exact cleanup are in the execution
ledger's07:56 checkpoint. Focused diagnostic98426 then passed the SAME limits,
largest sustained/outside steps0.176 at speed10.56, with frame evidence retained.
QA-only40aca4f/f6f420d attach samples before assertions and include simulation
frame/time; no production code, threshold or timeout changed. Complete rerun
**88641 ACTIVE**, `/tmp/eidolon-rest58-all-node24-rerun-0755.log`. This is not a
completed regression or production delivery. Earlier evidence below is historical.

Status at September 9, 07:18 UTC: **unpublished candidate**, not delivered.
Candidate worktree `/tmp/eidolon-standalone-town-recovery-QJ6Drv`, current source
`ee8a713d6d6daef1caa5d319c63c2089fdf37771`, includes canonical57/6babef5 ancestry.
Production runtime is unchanged from previously tested
`5a17be147ce527bae556663cc452ecae10e87785`; subsequent corrections change QA only.
53CI34312290353 completed successfully, including all final live checks. Public
manifest, login version, loaded runtime URL and server health independently match
53/ce330b3 at06:08; client/server rechecked06:43. First54CI34317808528 failed
before deployment on a prepared visual timer. Corrected54/5e22b74 is pushed,
remote verified, new54CI34320477081 has all client/server/browser jobs passed
and is in predeploy gameplay. No55push until the complete54 gate.
The complete roadmap remains open. Expanded story and coordinated balance are
separate preserved work, not removed or declared complete by this release.

## Supported-toolchain regression and ordinary earned play

Local npm/Playwright uses Node24.18.0 explicitly inside `sg render`; the login
shell's default Node18 is not supported acceptance. Full client57780 passed
245suites/3466tests/187.057s plus lint. Full Go race75384 passed root23.243s and
game327.779s; server/go.mod selects Go1.24.5. Logs:
`/tmp/eidolon-rest58-node24-full-client.log`,
`/tmp/eidolon-rest58-node24-lint.log`,
`/tmp/eidolon-rest58-full-server.log`.

All four ordinary fresh-class routes passed on5a17be1, with no grants,
forced kills, extended encounter deadlines or removed console/network assertions.
The existing eight-seed collection, manual turn-in, saved earned gear and locked
level30 dungeon were checked. The wrappers removed their exact temporary
containers/images; absence was independently verified. Credential scans changed
zero files, and ready-to-claim screenshots were inspected after archival.

| Class / handle | Total test | Collection | Observed target deaths / player deaths | Full-pool town stops | Stop time including travel |
|---|---|---|---|---|---|
| Wizard69597 | 4.7m | 213s | 19 / 0 | 4 | 83.664s |
| Fighter58871 | 6.7m | 289s | 17 / 0 | 4 | 86.038s |
| Rogue34088 | 4.2m | 212s | 23 / 0 | 3 | 63.975s |
| Cleric21402 | 3.7m | 174s | 20 / 0 | 2 | 39.157s |

Observed target deaths are not an exhaustive kill census or a drop-rate estimate.
These routes use current legacy payouts:500XP opening and8000XP collection,
100gold each. Collection still jumps characters to17; that is a known balance
issue for the coordinated successor, not something58 fixes. Rogue reached8 before
the claim; the other three reached7. Each stopped to recover at its actual
class/gear-adjusted ability cost, not a universal Wizard30mana assumption.

Logs and retained screenshots:

- Wizard: `/tmp/eidolon-rest58-wizard-node24-rerun-0528.log`;
  `/tmp/eidolon-rest58-wizard24-proof-c7jLU7/test-results`.
- Fighter: `/tmp/eidolon-rest58-fighter-node24-0535.log`;
  `/tmp/eidolon-rest58-fighter24-proof-h4p5PS/test-results`.
- Rogue: `/tmp/eidolon-rest58-rogue-node24-0545.log`;
  `/tmp/eidolon-rest58-rogue24-proof-mvJ29A/test-results`.
- Cleric: `/tmp/eidolon-rest58-cleric-collection-0515.log`;
  `/tmp/eidolon-rest58-cleric-proof-TKN8ET/test-results`.

## Failures remain part of the evidence

Wizard97055 failed the final console/network assertion with
`net::ERR_NETWORK_CHANGED`; its unchanged repeat69597 passed. The cause is not
proven. A later read-only monitor observed unrelated virtual-network churn, also
during passing play. No unrelated workload was changed and no errors were filtered.
See the execution ledger for original log/archive and the closed monitor.

Native rest32952 terminated143 after a passing natural-expiry test37.3s, before
journey and party completion. Bank14.81542373s expired naturally to0 outside town,
strength11→10 and maxima110→100, icon/aura removed; normal Recall earned1.750368119s
and restored the rested stats/aura. Do not count the whole invocation as passed.
Original log `/tmp/eidolon-rest58-native-node24-0548.log`; credential-scanned
partial screenshots `/tmp/eidolon-rest58-native24-interrupted-SZjDjQ/`.

The wrapper/test processes were absent after terminal143, but an orphan static
server and its exact disposable API/Mongo remained. The web server's candidate
cwd, start time and process ancestry were verified before stopping only248702;
its parent shells exited. The exact run-specific containers, temporary Mongo
volume and image were removed. Port41960, process family and resources were
independently confirmed absent. No production data or CI process was touched.
No matching OOM event was found in the accessible kernel log; termination cause
remains unknown. **81669 unchanged native24 repeat passed**, project
rest58-native24-r1-0552, log
`/tmp/eidolon-rest58-native-node24-rerun-0552.log`: expiry36.3s and journey31.0s
(first CLI2tests/1.1m), actual party24.1s (second CLI1test/25.9s). The wrapper
exited0, credential scan0, and exact owned containers/image are absent.

Natural expiry14.617466611s→0 removed strength11→10, maxima110→100 and icon/aura;
ordinary Recall earned1.617247573s and restored them. The journey registered an
actual42damage Wizard spell hit with30mana spent, then Recall and reconnect:
returned MP94, rejoined MP110 through normal town recovery. Reconnect bank
14.744371348s retained/continued legitimate online town earnings. Two actual
party members moved through the native joystick and rendered19visible parts each
at High,10each at Low, without opaque box geometry.

Both output folders are archived at `/tmp/eidolon-rest58-native24-proof-n1IyTo/`.
Desktop reconnect, portrait390 High status/aura and short landscape568 Low status
were visually inspected. The desktop reconnect capture shows16FPS while other
captures show higher rates under concurrent CI load: this is not sustained
performance approval or proof that the aura caused a slowdown. Physical-device
and sustained gameplay performance remain open roadmap gates.

**57389 complete58 isolated gameplay FAILED**, terminal1: two authenticated
tests passed, but the third actual entrance click selected InfernoTitan rather
than DungeonEntrance. The assertion remains strict. Scan0 and exact owned
cleanup confirmed. Log `/tmp/eidolon-rest58-all-node24-0554.log`, archive
`/tmp/eidolon-rest58-full-portal-failure-U24ntr/test-results`.

Source inspection and a deterministic4fail/2pass baseline exposed a test-helper
freshness gap: it accepted old hover while the new pointer raycast was deferred.
The helper now observes `needsRaycast === false` and the actual on-canvas pointer
before accepting a matching entrance. No forced raycast or hover assignment;
production priority,15s deadline, candidate sampling, final click and real dungeon
assertions remain unchanged. A mismatching click now logs the existing public
probe before failing. This does not prove every potential moving-enemy overlap
comes from the stale-hover gap.

New source51c9bf7 focused91607 passed239observation/version tests1.273s plus lint;
67666 passed17observation/actual GameEngineRaycastPriority tests1.089s. Original
bare-Jest invocation failed ESM discovery; supported baseline used `npm test`.
See candidate `docs/plans/2026-09-09-entrance-pointer-observation.md` for details.

12405 full client/lint passed246suites/3472tests/136.825s on51c9bf7. Log
`/tmp/eidolon-rest58-fresh-pointer-full-client.log`. Focused actual portal97047
passed1/20.1s including real reentry/jump-Recall (test18.1s), scan0/exact cleanup;
log `/tmp/eidolon-rest58-portal-node24-0601.log`, result metadata archive
`/tmp/eidolon-rest58-portal24-proof-fKJOtg/test-results`.

Full rerun92856 then failed a different assertion: two LootDrop hitboxes overlapped,
and manual pickup QA insisted on the covered drop while the real pointer selected
the front one. Login and portal tests passed. Original log
`/tmp/eidolon-rest58-all-node24-rerun-0602.log`, sanitized archive
`/tmp/eidolon-rest58-full-loot-failure-sKrdfS/test-results`; terminal1, scan0/exact
cleanup. This failed complete run remains failed, not superseded retroactively.

New a7ef83c adds explicit general-pickup opt-in to follow the actual front loot
only when both active drops share the raycast stack. Strict specific-item callers
stay strict; stale/off-canvas/hostile/unrelated/no-item targets are rejected. The
actual picked item's quantity and reconnect receipt remain mandatory. No runtime
change, direct pickup, fake grant, slot-count proof or deadline extension.
Baseline58464 reproduced6fail/3pass; corrected22244 passed26tests/3suites/1.112s
plus lint. Browser geometry62614 passed2/8.3s: enemy-covered center/exposed edge
and exact coincident front/back loot. These fixtures do not establish a server
pickup; the full route must still do that. Details in candidate
`docs/plans/2026-09-09-overlapping-loot-observation.md`.

**33950 full client/lint passed**, terminal0,247suites/3481tests/121.961s; log
`/tmp/eidolon-rest58-loot-observation-full-client.log`. **12130 complete gameplay
FAILED** on a7ef83c: authentication, dungeon/inventory, area abilities and phone
movement/combat/party/inventory passed, then legacy gem recovery expected base
Intelligence10 instead of legitimate rested total11. Original log
`/tmp/eidolon-rest58-all-node24-rerun-0610.log`; sanitized archive
`/tmp/eidolon-rest58-gem-rest-failure-e5EF2M/test-results`, scan0/exact cleanup.

QA correction7f066a4 requires base10, rested11, positive bank and Lanternhold
before and after reconnect. Unsupported+999 gem bonuses still fail; full-bag
rejection, legal sword equip, exact18+5 gems, rejected loose-gem equip and actual
Mongo/reconnect remain required. Focused97572 passed1/13.3s; scan0/exact cleanup.
Log `/tmp/eidolon-rest58-gem-rest-browser-0630.log`; metadata archive
`/tmp/eidolon-rest58-gem24-proof-wjeDn3/test-results`.

Current6e85547 also inherits54's corrected prepared respawn fixture clock through
the canonical release chain. No production/version/script changes were imported.
**1416 full gameplay FAILED**, Node24.18.0,
projectrest58-all24-r3-0909-0650/API18560/Mongo18561/web41960; log
`/tmp/eidolon-rest58-all-node24-rerun-0650.log`. **81287 full client/lint PASSED**,
248suites/3490tests/125.305s, terminal0, exact6e85547/Node24.18.0;
logs `/tmp/eidolon-rest58-finalclock-full-{client,lint}.log`.

1416 passed the corrected gem case, Forge/Guide, ordinary opening/collection,
and talent economy/healing, then failed the duration test's obsolete expectation
that the panel be empty after shield expiry. Server shield timer/HP/effect/badge
removal checks passed; the error snapshot shows earned Well Rested still active.
Archive `/tmp/eidolon-rest58-duration-rest-failure-ATQ2N9`; scan0/exact cleanup.
The corrected assertion requires the shield gone and the resting row retained;
a PhoneStatusUI coexistence regression covers it. Focused19tests/lint passed.
Actual duration replay48279 passed1/1.1m on currentee8a713, including natural
ranked expiry and saved landscape cast; scan0/exact cleanup. Archive
`/tmp/eidolon-rest58-duration24-proof-Sei3x7`, log
`/tmp/eidolon-rest58-duration-rest-browser-0713.log`.

Public-proof review found the native journey imported a test module that Pages
does not publish. The current observer injects only its trusted self-contained
read-only counter; the journey blocks/tests network access to enforce that
boundary locally. It additionally requires actual hostile damage, living HP
below maximum, accepted Fireball/spent mana, Recall and full recovery of both
pools. No shared localhost wall clock, grants or longer test deadline is used.
Focused26tests/lint/discovery passed; that is not actual public gameplay proof.
**99620 stronger native journey PASSED1/38.7s** (test36.5s), exactee8a713:
actual hostile damageHP110→108, accepted FireballMP110→80, ordinary Recall
returnedHP110 andMP95, then both110/110 before and after reconnect. Earned
rest/aura retained, with all/tests network requests blocked. Scan0/exact cleanup;
log `/tmp/eidolon-rest58-public-proof-browser-0716.log`, archive
`/tmp/eidolon-rest58-public-recovery-proof-HWZkIN`. Rejoined screenshot viewed.
Its11FPS under concurrent work is not sustained performance approval or a causal
diagnosis. This invocation used `well-rested`, which runs ONLY the journey;
expiry/party were not rerun here. Complete `all` retains all three native tests.
**37941 full client/lint PASSED248suites/3492tests/157.555s**, same source, logs
`/tmp/eidolon-rest58-public-proof-full-{client,lint}.log`.
**65093 complete gameplay ACTIVE**, only owned local browser, frozenee8a713,
projectrest58-all24-r4-0909-0718/API18560/Mongo18561/web41960, log
`/tmp/eidolon-rest58-all-node24-rerun-0718.log`.
Preserve artifacts/verify exact cleanup when terminal. Complete gameplay still
needs a new full pass; no failure above is retroactively changed to success.

## Remaining delivery gates

- Finish the complete unchanged58 isolated gameplay chain, including all prior
  dungeon/combat/equipment/phone/animation checks and the added native rest routes.
- 53 is delivered; publish each remaining predecessor54–57 only after its complete CI/deploy/final live QA
  and independent exact client manifest, runtime script and server identities.
- Publish58 through that same gate, with its existing58 login/patch notes.
- Independently verify public58 identities, then use fresh dedicated ordinary
  QA characters against the public client and WebSocket. Verify actual combat
  depletion, normal Recall, full HP/MP recovery, earned/resting buff display,
  outside countdown/expiry and reconnect. Do not use a prepared resource grant
  as proof of live healing; do not use a localhost-only clock predicate remotely.
- Record exact live source, observed values and retained sanitized evidence.
  Only then report town recovery delivered. Keep the larger roadmap active.
