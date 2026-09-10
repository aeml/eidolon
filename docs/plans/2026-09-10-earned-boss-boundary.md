# Keep earned boss retreat inside the intended room

Status: QA correction implemented; focused, full client/lint and prepared
two-boss native checks passed. Earned dungeon acceptance remains pending. No gameplay,
server balance, resource, collision, version or deployment change.

## Evidence

Failed44188's exact generator2 seed-1263584004433865125 reconstructs the recorded
death point in normalroom1, centered(20000,19820). RootboundWarden's bossroom3
is centered(20000,19460),120×120. The death point is313.165357units from that
boss-room center. This establishes that the character died well outside the
boss room; it does not reconstruct the final moving enemy positions or prove
that room drift was the sole cause of death. Those positions were not retained.

Production-generator regression `TestEarnedVerdantFailureGeometry` preserves
the exact seed/version/room identity. Final87176 passed0.074s; diagnostic log
`/tmp/eidolon-earned-death-geometry-final.log`. No forced native seed capability
was added and no prepared layout is being passed off as the failed live instance.

The dungeon callback receives `(page, target)`, but the ranged driver previously
only read `{encounter}` from its first argument; the dungeon caller also supplied
no fixed boss-room boundary. Consequently the floor-aware retreat plan could
continue through connected corridors and earlier rooms. The existing circular
encounter support was not actually constraining this boss fight.

## Correction

- Resolve each named boss against its fixed generated boss room, not the moving
  enemy's position. A known boss without valid room geometry fails closed.
- Pass that detached room rectangle through the actual combat callback and read
  it from the target for Wizard/Rogue. Retain direct `{encounter}` callers.
- Keep the actor's full-radius margin inside the rectangle when choosing a
  nine-unit retreat; continue checking the entire real collision/floor path.
  Existing circular investigation boundaries retain their prior behavior.
- Keep no-path behavior and all state/death/damage/encounter/phase watchdogs.
  No position injection, teleport, enemy stat change or resource grant occurs.
- Log the fixed boss-room bounds and sampled player coordinates during future
  fights; the separate spatial death snapshot captures additional failure facts.

## Verification and next gate

Final33679 passed85tests/7suites1.305s and lintNode24.18.0. This includes an
actual shared-route callback dispatch test, both ranged class context adapters,
fixed-room mapping, recorded outside-room position, body margins, ordinary
collision rejection and circular-context compatibility. Logs
`/tmp/eidolon-boss-boundary-final-{unit,lint}.log`.

Earlier test-only failures remain in the intermediate logs: missing Playwright
mock, incompatible optional assertion-message API, then a missing mocked
world-age observation. Corrected the test adapters/observation sequence without
removing assertions or changing any gameplay limit; none was a native run.

### Completed full and prepared native checks — September 10, 12:08 UTC

Clean source **23bc0673b9d7ee4ca3842572408cd5c6a4fdec4d** passed all299client
suites/4187tests in128.334s, followed by lintNode24.18.0. The launch handle was
lost in truncated output; completed logs and absence of a matching test process
were revalidated instead of restarting the suite.

Native27282 TERMINAL0: existing isolated `verdant` route, runID
`bounded-verdant-0910`, one test passed4.0minutes with zero retries. Seed
-5388765118892393174, generator2/attempt0/no fallback, normal30/preparedWizard100.
Both RootboundWarden and BriarMatron died, later ordinary/elite enemies spawned
and died, both boss-room cleared assertions and Gold gain passed, and the route
completed normal Recall to town. Actual credential scan passed0sanitized files;
owned API/Mongo containers and18580/18581/41980listeners were absent afterward.

Archive `/tmp/eidolon-bounded-verdant-proof-fWZAtp` contains the report,
test-results, native log and full client/lint logs. Native stream remains at
`/tmp/eidolon-bounded-verdant-native.log`. The route disables recordings, so this
is input/state evidence, not screenshot-based visual acceptance.

All FOUR logged Warden samples fit inside its120×120room centered(20000,19640)
with the1.25actor margin. All FIVE Matron samples likewise fit inside its room
centered(20000,19100). These are fifteen-second samples, not a continuous
trajectory assertion. Warden observed15000→2977thenconfirmeddeath; Matron
16800→1426thenconfirmeddeath. No death diagnostic was exercised.

The route uses an explicit level100 fixture, normal UI talent/rune purchases
and the existing five-minute protected entrance waypoint. It is not earned31
survival/balance, a four-boss clear, manual story reward, save/rejoin or Water
handoff acceptance. Failed44188 and96530 remain failures.

### Next gate

Verify ordinary town resource recovery and same-run re-entry after real cleared
encounters, including unchanged seed/difficulty/level, cleared rooms, earned
Gold/inventory and story state. Capture depleted pools before Recall and actual
safe-zone restoration; do not substitute a fixture refill, death/respawn, reset,
new instance or replayed room rewards. Existing recovery checks cover death or
empty-entry recall, not this entire post-combat resource/progress combination.

Only then integrate justified between-encounter recovery into earned dungeon
play, preserving traversal, encounter and whole-run deadlines. Appropriate
earned kit/resource use and wider class/group balance still need investigation
before another hour-long fresh campaign replay. Full four-boss/manual-reward/
save/Water requirements remain unchanged.

The explicit isolated `prepared-dungeon-rest` diagnostic now implements the
first post-combat check, but has not yet run natively. It observes spent mana
after the existing two-boss/cleared-room/Gold assertions and before Recall,
waits for normal sanctuary recovery, then uses the actual town guide without a
reset or new waypoint. Its detached snapshot compares the same instance, seed,
generator, difficulty, run level, cleared rooms, Gold, bag contents, level and
quest progress after re-entry. It does not claim depleted-HP recovery: the
prepared protection can prevent HP loss. It also does not establish persistence
across login/server restart or normal-level resource pacing.

Focused22626 passed20tests/3suites0.828s and lintNode24, including snapshot
detachment, changed-progress detection, explicit-route guards and the actual
post-clear callback ordering. Logs `/tmp/eidolon-dungeon-town-rest-focused.log`
and `/tmp/eidolon-dungeon-town-rest-lint.log`. Full regression and the explicit
native diagnostic remain required before this additional route is accepted.
