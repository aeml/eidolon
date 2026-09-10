# Keep earned boss retreat inside the intended room

Status: QA correction implemented; focused checks passed. Full regression,
prepared native and earned dungeon acceptance remain pending. No gameplay,
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

Next run full client regression/lint on the committed source, then the existing
isolated `verdant` route (prepared level100, first two bosses/later spawns).
That is a shorter functional input check, not a substitute for earned31/full
four-boss/manual-reward/save/Water acceptance. Inspect its coordinate samples
against the logged rooms and preserve every failure. The original failed44188
and96530 remain failures regardless of this result. Ordinary between-encounter
town recovery, appropriate earned kit/resource use and wider class/group balance
still need investigation before another hour-long fresh campaign replay.
