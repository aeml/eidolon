# Full dungeon playthrough evidence — 1.1 gate

This is a verification record, not a claim that the 1.1 dungeon gate is closed.
The required scope remains the five dungeons, four classes, parties, abilities and
runes, three generated layouts per dungeon, campaign credit and raid unlocks,
recovery/reconnect, and High/Low scene inspection in the main roadmap.

## Reproducible player-control route

`tests/e2e/verdant-dungeon-gameplay.spec.js` retains its default two-boss Verdant
smoke for CI and now accepts all five dungeon catalog keys. Full runs walk the
canonical room/corridor joins, fight ordinary enemies and every boss using mouse
attacks and available skills, require every encounter room to clear, check gold,
recall to Lanternhold, re-enter the same completed run, and check that boss progress
and gold did not reset or duplicate. Run-level/difficulty choices use the actual
menu. The regional entrance stays locked to its own destination; other dungeons
are selected through Lanternhold's guide.

Example on this Linux QA host (use unused ports):

```bash
sg render -c 'EIDOLON_E2E_DUNGEON=molten_core EIDOLON_E2E_CLASS=Fighter EIDOLON_E2E_WEB_PORT=4187 EIDOLON_ISOLATED_QA_PORT=18187 EIDOLON_ISOLATED_QA_NETWORK_MODE=host EIDOLON_ISOLATED_QA_ROUTE=dungeon-full EIDOLON_E2E_BROWSER_PATH=/usr/bin/google-chrome npm run test:e2e:isolated'
```

Select `EIDOLON_E2E_DUNGEON_DIFFICULTY=normal|heroic|mythic` and a ten-level band
with `EIDOLON_E2E_DUNGEON_LEVEL`. Defaults are the region's minimum level. Set
`EIDOLON_E2E_DUNGEON_FALLBACK=1` for the deliberately exhausted generator path.
Invalid dungeon/difficulty/level selections fail rather than silently testing a
different row. Umbral Nexus still requires the four restored crystals; this route
does not forge Chronicle completion or unlock raids. A fresh isolated character
therefore cannot supply Umbral player-control evidence yet.

Each run logs dungeon, seed, generator version/attempt, fallback state, class,
difficulty, level, source commit and whether the source worktree was dirty. It
does not log the instance/account identifier. Disposable API/Mongo services and
data are removed when the runner exits; credential artifact scanning is retained.
The runner records the source commit in the test server's build metadata, with a
`-dirty` suffix when its source worktree contains changes (including new files).

The character is raised to level 100 with existing allowlisted QA setup; the
existing entrance waypoint provides five minutes of incoming-damage protection.
No inside-instance waypoint, direct health edit or force-kill command is used.
These are functional runs, not level-appropriate balance tests. The full-run
combat timer permits eight minutes per encounter with a separate 60-second
no-damage-progress watchdog; full runs now have a 40-minute aggregate budget
(short Verdant smoke retains 25 minutes). The defensive Fighter route selects
Bloodwhirl/Fortify/Extended through the rune UI and uses ordinary hotbar defenses;
it must observe all four server-accepted skill events by the first boss death.

## Recorded full runs

September 6, third-class full run: clean
`fba546a4994f4190b60e496ecb1e8e8ec5665ab3` passed **Rogue Verdant in 8.9 minutes**
(test body 8.8), Normal 30, generator 2 / attempt 0, seed
`-7334011171890423023`. Normal mouse/basic and primary-ability inputs defeated
Rootbound Warden, Briar Matron, Rustbound Colossus and Hollow Sentinel, cleared
every encounter room, awarded gold and preserved seed/boss progress/gold across
completed-run recall and re-entry. Credential scan and disposable cleanup passed;
log `/tmp/eidolon-1-0-23-verdant-full-rogue.log`, session `37673` closed. This uses
the documented level-100/entrance-protection setup and does not verify Rogue
specialization hotbars/runes, fresh-level balance, Chronicle credit or party combat.

September 6, earned Earth campaign: `d5b4320` plus the Alpha 1.0.23 inventory-sync
correction passed **10.1 minutes** of real Wizard play, Normal 30, generator 2 /
attempt 0, seed `-3877784623499751578`. The dedicated `chronicle-earth` isolated
route accepts Ilyra's first three chapters, earns kills and random seed drops,
asserts exact physical-item consumption, clears all rooms and the four bosses,
recalls/re-enters without reset or duplicated gold, then proves the raid remains
sealed until manual chapter-3 completion. Rootheart access and completed chapter
state persist after reload/login. Credential scan and disposable cleanup pass;
log `/tmp/eidolon-1-0-23-chronicle-earth.log`, session `47393` closed successfully.
The first attempt's stale-bag failure is retained in the execution ledger, not
erased by this pass. The shared level-100 and QA travel/protection limitations
apply; no quest progress, relic, kill or raid unlock was granted. This adds an
earned campaign link and another layout, not physical traversal inspection of
every layout/class/dungeon, full Wizard hotbar/rune coverage or actual raid combat.

September 6, current-runtime addition: clean
`a323d966f4177fa4a3fe8db3916801a76d3c79aa` passed the full Verdant route with a
**Wizard in 8.4 minutes**, Normal 30, generator 2 attempt 0, seed
`4005696311737504843`. Rootbound Warden, Briar Matron, Rustbound Colossus and
Hollow Sentinel died through real mouse attacks/Fireball. All encounter rooms
cleared, gold increased, and completed-run recall/re-entry preserved seed,
cleared bosses and gold. Credential scanning and disposable cleanup passed;
session `18569` is closed. Log: `/tmp/eidolon-1-0-22-verdant-full-wizard.log`.
This is a level-100 functional run with the documented entrance protection,
not level-appropriate balance, all Wizard specialization/rune skills, party combat
or Chronicle credit. The next route adds earned opening chapters, natural relic
drops and manual post-dungeon raid-unlock verification without granting progress.

| Dungeon | Class/path | Replay identity | Evidence |
|---|---|---|---|
| Verdant Bastion | Fighter, complete generated | Seed missing from the original log | Passed all four bosses, room progress, gold and recall in 7.5 minutes on 1.0.7 source; no completed-run re-entry assertion in that earlier route. |
| Verdant Bastion | Fighter, complete forced fallback | Generator 2 fallback | Passed all four bosses, ordinary combat and recall in 8.2 minutes on the 1.0.6 candidate. |
| Molten Core | Fighter, complete generated attempt | `-4082835836665611972`, generator 2, Normal 70 | Three ordinary enemy types killed; Cindermaw damaged from 39,000 to below 8,148 HP, then the obsolete two-minute test timer expired. Not a full-run pass. |
| Molten Core | Fighter, complete generated rerun | `7439113819114914641`, generator 2, Normal 70 | **Passed in 23.8 minutes:** all five bosses killed through normal controls, every encounter room cleared, gold increased, town recall and completed-run re-entry preserved seed/boss progress/gold. Source `968c2c7` with QA-route worktree changes; this server image predates the wall repair below. Log: `/tmp/eidolon-molten-full-fighter-bounded.log`. |
| Abyssal Well | Fighter, complete generated attempt | `-7057617757322159080`, generator 2 attempt 0, Normal 60 | **Failed after 18.7 minutes:** all first four bosses defeated, then the character died during a Siren encounter before Thalorath. Source `20eadc9483abbc6d2bd19f1bde0a2a3f78bda4b9`, clean. No full-run/re-entry pass or fifth-boss evidence. Log: `/tmp/eidolon-1-0-9-abyssal-full-fighter.log`; disposable cleanup and credential scan completed. This route currently uses damage skills without defensive-skill/rune management or wipe recovery. Source inspection found no potion system; investigate the existing Iron Fortress/Guardian Roar skills and Bloodwhirl/Fortify runes through normal UI, plus wipe recovery, without granting health or kills. |

An additional defensive Abyssal attempt on dirty `6212ef3`, seed
`-412794620771892541`, generator 2 attempt 0, Normal 60, **failed at the old
25-minute aggregate timeout**. The first four bosses died; Thalorath had 18,626 HP
remaining and the Fighter had 2,575/2,575 HP. All four normal hotbar skills were
observed. This is not a fifth-boss/full-clear/re-entry pass. Log:
`/tmp/eidolon-abyssal-full-fighter-defense.log`. The later mana-selector field fix
and 40-minute aggregate budget were not part of that running test.

The corrected defensive run on clean
`a8c09ef4db43162b4752437e757c70d4859b5bad`, seed `-3014860983784452515`, generator 2
attempt 0, Normal 60, **passed in 29.1 minutes**. All five bosses were defeated
through normal controls, every encounter room cleared, gold increased, and
completed-run recall/re-entry preserved seed, cleared boss state and gold. Actual
events confirmed all four hotbar skills; the corrected mana selector and chosen
Bloodwhirl/Fortify/Extended runes were used. Log:
`/tmp/eidolon-1-0-10-abyssal-full-fighter-recovery.log`. Credential scan and
disposable cleanup passed. This is one level-100 functional Fighter run at Normal
60, not level-appropriate balance, three successful generated instances, other
classes, a party clear, or campaign/raid-unlock credit. It predates the subsequent
local direct/basic-attack wall patches.

The first regional attempt tried to select Molten at Verdant's locked portal and
failed before entry. Correcting the test to use the town guide resolved that
fixture error without changing any game access rule.

Other class/dungeon/full-run/party rows remain open. Neither the fixture gallery
nor the server matrices below count as three real player-controlled generated
instances per dungeon. Do not turn partial, unseeded or failed runs into that claim.

## Actual death and unfinished-run recovery

Tempest Spire's full Fighter run on clean
`3dbb76d0a24d972e756583023e2ba4a11356cff0`, generator 2 attempt 0 seed
`3202185699779077470`, Normal 70, **failed after 9.2 minutes**. Windshear and
Stormcallers died through ordinary combat; the player then died while fighting
a Cloud Elemental in a later room. The log does not establish the exact incoming
damage sources or prove a balance/targeting defect. This is not a full-clear pass.
Log: `/tmp/eidolon-1-0-10-tempest-full-fighter.log`. The route now retains a bounded,
account-ID-free incoming damage/healing history and prints it on death, alongside
position, mana and cooldowns, to make the next survival failure diagnosable. It
does not add protection, healing, damage or a forced recovery.

The next clean `ba4a32e5477da6f13105f278eb5f40a207abe241` run, generator 2
attempt 0 seed `-1329185764639002788`, Normal 70 Fighter, **failed after 29.7
minutes at the six-minute encounter deadline**. Windshear, Stormcallers, Roc
Matriarch and Thunderlord Kaelix died normally. Zephyrion was continuously taking
damage (93,600 starting HP; 12,673 at the last periodic report); the Fighter was
alive at 2,021/2,575 HP in that report. The terminal error explicitly records
`observed damage=true`. This is not a final-boss kill or full-clear pass. Log:
`/tmp/eidolon-1-0-11-tempest-diagnostic.log`; credential scanning and disposable
cleanup completed. This server predates the local directional/aura/beam changes.
After that process terminated, the functional encounter ceiling was extended to
eight minutes. The 60-second no-damage watchdog, survival assertions, ordinary
combat inputs and 40-minute total ceiling remain. No combat stat or reward rule
was changed to pass this test; a new complete run is still required.

A fresh level-30 Wizard passed in 37.4 seconds on the dirty `6212ef3` recovery
candidate, Verdant seed `-1986625632463315919`, generator 2. Normal enemies
inflicted actual damage and death. Recall was rejected while the death screen,
instance and dead state remained; explicit Respawn restored an alive actor in
Lanternhold. Normal guide re-entry preserved seed and cleared flags. No protected
waypoint, forced kill or health override was used. This is solo early-run recovery,
not a full clear or a party wipe. Log:
`/tmp/eidolon-dungeon-natural-recovery-browser.log`.

The fresh two-account Cleric/Wizard route passed both directions of member/leader
recall and re-entry without resetting the player who stayed inside (1.0 minute,
`/tmp/eidolon-party-guide-investigation.log`). The original Alpha 1.0.10 CI guide
failure has not reproduced and remains documented in the execution ledger.

## Authoritative combat matrices

- Basic attacks at the replicated body boundary now cover all 27 dungeon/raid
  boss types with Fighter, Cleric, Wizard and Rogue: 108 combinations.
- All 22 bosses across the five dungeon coordinate regions accept and take
  damage from Whirlwind, Shield Slam, Radiant Strike, Fireball and Piercing Throw,
  including five representative rune variants: 220 combinations. Each test also
  puts a boss at the same coordinates in another instance and requires no damage
  there, and verifies mana/cooldown consumption. Focused race checks pass.
- These fixtures use real boss definitions and normal skill/projectile handlers,
  but do not establish rendered ability feedback, full boss phases, party play,
  progression credit, or level-appropriate difficulty.

## Newly reproduced wall issue

Normal fireball/dagger casts crossed a solid gap between two connected dungeon
rooms. Both shot endpoints were inside legal floors, including a large simulation
step that jumped the whole gap. Four red regression cases reproduced this.

The local repair clips the complete travel segment against the union of canonical
walk rectangles. Shared boundaries/overlaps and real doorways remain passable;
the first uncovered segment terminates the projectile and emits a terminal impact.
The server sends explicit radius zero for a wall hit, and both client dispatch
and procedural impact rendering preserve zero instead of inventing an explosion
damage ring. Overworld/PvP and legacy instances without canonical geometry retain
their prior behavior. Ground-targeted AoE, direct attacks, movement abilities and
cross-wall secondary effects are not claimed fixed by this projectile change.

Focused race tests pass for normal/large steps, doorways, reversed/diagonal travel,
edge tangency, overlaps, a thin gap, and far-offset geometry. Client checks require
visible impact geometry without an area-damage boundary. A fresh-server real
Wizard cast route now **passes in 11.3 seconds** against a fresh server containing
the repair (`/tmp/eidolon-dungeon-wall-wizard-browser-wire.log`): real entry, ground
clicks to the wall, right-click Fireball, authoritative terminal impact at the wall,
zero-radius client presentation and recall. It joins the disposable CI sequence
for Wizard characters; non-Wizard runs skip this class-specific presentation
test. Invoke it alone with `EIDOLON_ISOLATED_QA_ROUTE=projectile-walls` and
`EIDOLON_E2E_CLASS=Wizard`.

The first attempt stopped walking too early because the movement helper promises
motion, not full arrival; a bounded arrival check corrected that fixture. The
next attempts exposed a real integration omission: the internal game event
preserved radius zero, but `ProjectileImpactPayload` dropped it with `omitempty`.
A failing wire-format regression demonstrated the loss. Both payload layers now
preserve zero, and the fresh browser rerun above passes. Event inspection is
scoped to the local caster and current instance.

The full server race suite and 149 client suites / 2,179 tests passed before final
release metadata; final candidate checks are recorded in the execution ledger.
A focused in-room segment benchmark on this host's AMD Ryzen 7 5700G measured
45.13 ns/op, 0 B/op and 0 allocations. This is a hot-path check, not a whole-game
performance or concurrency claim. The completed Molten run predates this repair
and cannot verify it.

## Complete Tempest Spire — clean Alpha 1.0.12 candidate

The complete generated Tempest route passed in **31.5 minutes** (31.6 including
browser overhead), `/tmp/eidolon-1-0-12-tempest-full.log`. Source was clean
`fd93bd3b89d1817762df757a6568e14be8dd1794`, seed
`-5249240270438193008`, generator 2 attempt 0, Normal 70, Fighter level 100.
Ordinary controls defeated Windshear, Stormcallers, Roc Matriarch, Thunderlord
Kaelix and Zephyrion, then completed-run recall/re-entry preserved the seed,
cleared bosses and gold. The run used the authored defensive build and the
eight-minute encounter ceiling; it is not a level-appropriate balance benchmark.
Credential scanning passed and the disposable services/data were removed.

This evidence predates the local Whirlwind duration implementation and cannot
verify it. One class/seed/solo clear does not close the all-class, party,
three-generated-instance or campaign quest/raid-unlock requirements.

## Complete Verdant after Whirlwind duration repair — 1.0.13 candidate

The fresh complete Verdant route **passed in 8.7 minutes** (8.8 including browser
overhead), `/tmp/eidolon-1-0-13-verdant-full.log`. Source was `fd93bd3` with the
local 1.0.13 candidate changes, seed `4391125778650393874`, generator 2 attempt 0,
Normal 30, Fighter 100. All four bosses died by ordinary attacks/hotbar controls;
completed-run recall/re-entry preserved the seed, cleared bosses and gold.
The normal defensive build selected Bloodwhirl, Fortify and Iron Fortress's
Extended rune. Credential scanning passed and the disposable services/data were
removed. This run includes the new server-owned Whirlwind pulses, unlike the
earlier clean Tempest run. It remains one solo functional route, not a campaign
quest/raid-unlock, party, level-appropriate balance or all-class completion claim.
