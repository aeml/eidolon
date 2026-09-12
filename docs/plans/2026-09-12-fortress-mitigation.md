# Iron Fortress protection — 1.1 candidate

The current-item armor audit in2026-09-12-party-armor-budget.md reproduced the
native role problem: plate Fighter183 versus Rogue184 damage per30 Warden hit;
40mana Fortress only reduced that to181. Offline instead applied1% damage
reduction per Strength (up to75%), without the server's armor/speed changes.

Standardize Fortress at20% incoming damage reduction, retaining50% armor and
20% movement penalty,40mana/60s base cooldown/30s base duration, existing runes
and saved ranks. The additional reduction covers all incoming damage through
the receiving pipeline, not only physical attacks. Apply it after outgoing
damage/armor and before other receiving reductions and shields. Require an
active flag and a valid future authoritative deadline. Mastery extends only
duration. No equipment migration, boss HP change or passive regeneration change.

Offline now uses the same20% strength-independent reduction, rebuilding armor
and capped movement speed once through the existing stat-recalculation helper.
Rebuild on cast, expiration and cancellation, including equipment changes during
the buff. Replicated actors never get local stat/damage modification. Expiry
moves after periodic damage in Actor.update; per-tick offsets distinguish hits
before/after expiry in a slow frame. Fighter now forwards that offset to Actor's
Phase protection too. Cost fixtures use lawful mana budgets when a cast rebuilds
stats instead of relying on synthetic mana above the actual maximum.

RED client3failed/4passed; server rejected the new mitigation expectations,
including a real paid Warden impact187 instead of149. After implementation,
7client suites338tests pass6.857s, full lint/diff pass. Server focused race
passes3.635s for receiving reductions, deadline boundaries, shields and their
ordering, actual paid current-item impact and all six armor comparisons.
Logs `/tmp/eidolon-fortress-mitigation-{client-red,server-red,client,server,expanded-client,expanded-lint}-20260912.log`.

Updated actual armor audit:30 plate baseline183, paid Fortress144;70 baseline478,
paid Fortress378. These are individual impact measurements, not whole-encounter
survival or balance approval. Full CI, native paid incoming-hit/deadline proof,
four-role dungeon replay, other encounter types and merged regression remain
required before release. Item quantization and tank threat/positioning remain
separate open issues; this change must not conceal failed dungeon evidence.

## Verification updates

Full CI34706648689 SUCCESS on50944fc2:405client suites6327tests114.363s;
game86.9% coverage104.409s and race354.744s; browser40+53+26=119actual passes.
Native/deploy steps were skipped on this development dispatch. Logs
`/tmp/eidolon-fortress-mitigation-ci-{client,server,browser1,browser2,browser3}-34706648689.log`.
This CI predates the incoming native gate and the special-path correction below.

The four-player run36216 on frozenbae69eeb failed16.2m on
seed-7217624267168898228 (generator2, attempt0, no fallback). Rogue died at the
first Warden; last sampled boss HP4238/15000. Fighter survived678/855HP. Healer
had228mana and was7.46units from Rogue at death, but earlier records show its
heals were on cooldown after a real targeted cast. This is not the previous
low-mana failure. TotalFighter5513damage/3968taken, Cleric4048allyhealing/736taken,
Wizard4664/0, Rogue7276/1584. Last Rogue hits were184physical from the Warden
at7.48units, consistent with ordinary melee range; do not infer invisible
telegraphs. Actual threat/spacing and healing cadence still need diagnosis.
Archive `/tmp/eidolon-party-fortress-mitigation-failure-Kwmr8z`; native log
`/tmp/eidolon-party-fortress-mitigation-native-20260912.log`; scan0 and owned
container/image/port cleanup pass. No clear, individual credit or Water handoff.

### Environmental and reflected incoming damage

A follow-up audit of direct Health subtraction found world hazards and reflection
outside the shared receiving pipeline. The original claim of all incoming
reduction was therefore incomplete. A shared lock-owned Fortress-only helper now
also protects these paths with the same active/future-deadline check. Existing
hazard percentage calculation, independent QA protection, shield bypass and
nonrecursive reflection behavior are unchanged; event receipts report the actual
reduced HP loss. No new reflection/absorption effects are introduced here.

Actual paid casts first failed: hazard loss82 versus65 and reflection100 versus80;
expired controls passed. Final focused hazard/Fortress/reflection/receiving race
passes13.828s. Reflection uses an actual paid level70 Thorns-rune cast and checks
that receiving reflected damage does not retaliate again. Logs
`/tmp/eidolon-fortress-special-incoming-{red,race}-20260912.log`.
This runtime follow-up needs new full CI/native/merged verification; neither
the earlier green CI nor the failed party build includes it.

### Incoming-hit native gate

Native9420 PASS3.6m, zero retries, frozen8864133e. Mastery rank0High30s,
rank5High36s and saved Extended rank5Low54s pass; the additional paid enemy-hit
check and living Recall pass. Same Skeleton receipts were2 damage before,1
during and2 after natural expiry. Armor was0 throughout: integer rounding means
this is protection-on/off evidence, not precise native20% measurement or equipped
armor validation. Higher damage/armor/deadline values are covered by paid server
tests; stronger native sampling remains desirable before broad balance sign-off.
The four-player failure is not converted into a pass.

Archive `/tmp/eidolon-fortress-real-incoming-pass-nFh6tq`; log
`/tmp/eidolon-fortress-real-incoming-native-20260912.log`; credential scan0,
owned containers/image/ports cleanup PASS. Main agent viewed the protected Low
phone capture; incidental41FPS is not a full performance pass. New full CI on
8864133e and combined-primary verification still required.

The existing non-retrying Fortress route now additionally approaches a real
overworld Skeleton through move-only ground input after its saved-rune check.
It observes three positive physical receipts from the same enemy unbuffed,
normally pays40mana for the saved Extended Fortress, then compares three real
incoming receipts with the armor-adjusted20% reduction. After natural expiry,
three more hits must return to their original damage and armor, with no buff
effect remaining. Recall must succeed without death/respawn. The prepared
level100 account is not an earned-progression or dungeon-balance claim.

The existing protection-off QA command explicitly primes nearest-hostile threat
and the initial normal swing; subsequent combat is ordinary AI. No HP/damage,
buff duration, clocks or combat-time resource refills are injected. Observations
retain complete source/target/amount receipts and local armor/timer/effect state;
the timer-boundary race itself remains a server receiving-pipeline assertion,
not something inferred from asynchronous browser timestamps.

Observer RED3failed/4passed (missing receipts and a reproduced duplicate wrapper
under layered movement observation); document-owned installation fixes duplicate
recording without changing real message delivery. Final4suites73testsPASS9.834s,
changed-file lint and diff pass. The subsequent native result and its limitations
are recorded above; authored checks alone are not runtime evidence.
Logs `/tmp/eidolon-fortress-impact-{observer-red,gate-tests}-20260912.log`.

## Proposed 1.1 patch note

Iron Fortress now consistently reduces incoming damage by20%, alongside its
armor bonus and movement tradeoff. Its protection no longer becomes negligible
against stronger enemies, and offline behavior matches the intended buff.
Existing Mastery ranks, rune choices, costs and durations are retained.
