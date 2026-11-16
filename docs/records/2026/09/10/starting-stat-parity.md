# Starting-stat parity for ordinary and prepared characters

Status: implemented locally; full Go race, full client/lint and all four actual
browser creation/override/relogin cases pass on clean aeff8ab5. Integrated
prepared-combat and release acceptance remain pending. This does not resolve
earned dungeon pacing or the full roadmap.

## Evidence and choice

The failed earned Wizard started with10 in each stat and reached level31 with
Intelligence40 before equipment. Real new-character creation in
`server/client_dispatch.go` has always used that all10 baseline in this candidate.
The separate `canonicalBaseStatsForClass` helper gave the class primary stat20
and was used by the allowlisted `/level` command and numerous progression audits.
Prepared tests therefore received an extra10 primary-stat points that ordinary
characters did not earn. There is no reason to buff or rewrite ordinary players
merely to make their stats match a test fixture.

13079 RED: all four class subcases fail at level1, game package.330s, proving
the discrepancy before changing the helper. Log
`/tmp/eidolon-initial-stat-parity-red.log`.

## Implementation and preservation

- Share `game.InitialPlayerStats()` between the extracted new-character factory
  and explicit level overrides. Every class retains the live all10 baseline.
- Call the factory only in the existing no-saved-character branch. Existing
  saves retain their recorded stats, including historical bonuses/allocations.
  No migration, database rewrite or change to ordinary XP growth was added.
- Remove the divergent class helper from progression, reward, dungeon and rest
  audits. Prepared fixtures now use actual starting stats. Tests that explicitly
  expected the old helper bonus were corrected, not weakened or skipped.
- At30, the override now produces68STR/39DEX/39INT/39WIS/68VIT for all classes,
  matching ordinary growth. At100, an ungeared prepared Wizard has basic27 and
  Fireball238; mastery5 plus Empowered yields570. Costs, cooldowns and passive
  regeneration stay unchanged. These are QA baseline changes, not player nerfs.
- The fresh opening route independently asserts all10 base stats before quest
  progress and includes them plus available points in its baseline receipt.
- Add explicit isolated `initial-stats` route: four separately registered class
  accounts verify initial stats, login persistence, normal visible `/level 30`
  input and a second login. The override is clearly labeled QA-only; it proves
  neither earned leveling nor campaign completion. Dedicated exact allowlist,
  loopback-only guard, zero retries and separate artifact directory are retained.

## Verification

- First post-fix focused run58485 exposed stale prepared expectations (two
  override cases, three Wizard budget cases); retained in
  `/tmp/eidolon-initial-stat-prepared-expectations-red.log`.
- 59062 TERMINAL0, focused Go race: root1.742s/game3.899s. Covers constructor
  defaults and independent copies for all classes, actual XP versus override
  parity at1/10/30/60/70/100, historic saved-stat preservation, command routing
  and non-QA rejection, migration, recorded gear and real Fireball budgets.
  Log `/tmp/eidolon-initial-stat-parity-final-race.log`.
- 78669 TERMINAL0, updated progression/reward/room/gear-band/rest audits under
  race, game13.889s. Log `/tmp/eidolon-initial-stat-audits-race.log`.
- 44419 TERMINAL0:78tests/4suites2.133s plus lint, covering affected fresh-route,
  training, progression and entry-receipt contracts.44883 TERMINAL0: final lint,
  shell syntax, diff check and discovery of4native class cases. Discovery is
  not a browser pass. Logs `/tmp/eidolon-initial-stat-client-unit.log`,
  `/tmp/eidolon-initial-stat-{lint,native-lint,native-discovery}.log`.

## Remaining acceptance

The socket/visual successor's all-route gate5956 has now passed and its evidence
is archived separately; it uses earlier source and does not verify these changes.
Full primary regressions and the `initial-stats` route subsequently passed on
clean aeff8ab5, as recorded below. Continue preserving source-specific evidence
without restoring inflated fixture stats or enlarging timers.
The creation/parity check is now the first required stage of this candidate's
`all` release sequence, using the same helper as the now-passed focused route.
It has not been published. The existing recovery suffix stays intact.
Revalidate prepared combat after the baseline change before publishing it.

The original earned Wizard fixture was already at the real baseline. This fix
does not improve that character's failed boss attempt; affordable preparation,
Normal solo/party intent, actual earned progress, all-class/party/dungeon/raid
acceptance and ordered version/patch-note/live deployment remain open.

Unpublished QA patch-note draft: prepared test characters now use the same base
stats as newly created players; additional checks cover all-class creation and
relogin. Ordinary character stats and saved progression are unchanged.

### Required gate wiring — September 10, 15:15 UTC

17790 RED41failed/1passed/1.853s before adding the required shared helper and
stage.13270 TERMINAL0:56tests/4suites2.381s plus lint, shell syntax and diff check.
Logs `/tmp/eidolon-initial-stat-gate-{red,unit,lint}.log`. Executed bash fixtures
verify opt-in flag, zero retries, artifact location and exact exit propagation;
the complete timed-sequence regression injects a failure at every stage and
requires later stages to stop while artifact scanning and cleanup still run.
All four exact account suffixes are checked. These are executable orchestration
checks, not substitutes for the pending actual browser cases or full regression.

### Full and native verification — September 10, 15:56 UTC

56611 TERMINAL0 on clean aeff8ab53ee5e2e45c9429a4728ddf962ef7a7eb:
full Go race (root29.617s/game401.028s; remaining packages passed/cached), then
305client suites/4231tests151.563s and lint underNode24.18.0. This was one serial
local heavy gate, launched only after the socket sequence had ended and cleaned
up. Logs `/tmp/eidolon-initial-stat-full-{server,client,lint}.log`.

37432 TERMINAL0 on that same clean tip: all four real class cases,50.4s total,
zero retries/skips. Each created a new ordinary account/character, checked the
all10 baseline, relogged, used visible allowlisted `/level 30` input, checked
68STR/39DEX/39INT/39WIS/68VIT and relogged again. Ordinary XP growth is covered
by the separate Go parity test, not claimed from this explicit QA override.
Historical/custom saved stats are covered by Go invariants and the unchanged
existing-character load path, not by a native legacy-save fixture in this route.

Archive `/tmp/eidolon-initial-stat-proof-h9RCZ0` contains available result tree,
final report and native/full-regression logs. Actual wrapper credential scan
sanitized0files; redirected native log contains0 disposable username prefixes.
Exact API/Mongo containers and image for `initial-parity-0910` are absent after
normal cleanup;18580/18581/41980 have no remaining listeners. No deployment,
version assignment, earned dungeon victory or full roadmap acceptance is claimed.
