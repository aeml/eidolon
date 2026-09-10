# Story-only earned Earth dungeon verification

Status: route implemented and client regression checks passed; full native
playthrough is not yet proven. This extends the existing 1.1–1.10 goal, not its
completion criteria. No runtime, release version, deployment or patch notes for
a shipped feature are changed by this test-only work.

## Required evidence

Run `EIDOLON_ISOLATED_QA_ROUTE=fresh-story-dungeon` through the disposable
character QA wrapper, with ordinary town recovery enabled. A new character must
earn the entire Earth story, clear all four Verdant bosses through real inputs,
manually claim Ilyra's dungeon reward, unlock Rootheart raid access and retain
that progress after login. The next required Water hunt must be offered but
not silently accepted. Accepted or completed daily quests fail the route.

No prepared levels, quest/item grants, encounter waypoints or fallback layouts
are permitted. Keep the legacy optional-daily dungeon route distinct; it is not
evidence of story-only progression. The earned dungeon driver currently supports
Wizard and Fighter. Rogue, Cleric and cooperative play remain required future
verification work, not implicitly covered by those drivers.

The original eight readiness phases retain their fixed 185-minute aggregate
observation ceiling. The new route adds a 40-minute dungeon phase and a separate
five-minute manual turn-in/access/save phase, giving one fixed 230-minute ceiling.
These are failure limits, not pacing targets. Existing encounter and navigation
watchdogs remain unchanged. A failed or skipped phase cannot report completion;
the enclosing test has no renewing timeout. Use zero retries and preserve the
original failure evidence if the real playthrough fails.

## Completed local checks

- Focused 57 tests in three suites passed in 1.021 seconds.
- Full client regression session 71870 exited successfully: 288 suites,
  4,063 tests, 149.604 seconds, followed by passing lint under Node 24.18.0.
- Shell syntax checks passed. Tests exercise actual Bash flag propagation and
  failure status for Wizard/Fighter, strict mode rejection, ordered phase
  completion and prevention of reward checks after failed dungeon traversal.
- The existing required release readiness gate is unchanged until the extended
  native route has its own evidence and release integration review.

Logs: `/tmp/eidolon-story-dungeon-unit-final.log`,
`/tmp/eidolon-story-dungeon-full-client.log`, and
`/tmp/eidolon-story-dungeon-full-lint.log`.

## Next action and remaining scope

The first frozen native attempt has now failed at Rootbound Warden after all
eight readiness phases passed. See the [failure evidence and next diagnostic
action](2026-09-10-earned-verdant-failure.md). Resolve the earned-gear/ability
verification gaps before repeating the long route. Retain the original failed
result; passing units are not dungeon or production acceptance.

The preceding fresh Wizard readiness proof is documented in
[earned Earth readiness](2026-09-10-earned-earth-readiness-proof.md). It completed
in 52.7 minutes but did not clear the dungeon. Later realms, all classes/groups,
all raids and repair events, Dark King phases, broader balance, visual/phone
acceptance and every remaining roadmap milestone still require their own work.
