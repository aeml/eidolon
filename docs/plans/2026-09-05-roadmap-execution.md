# Roadmap execution ledger

Objective: implement the full 1.1–1.10 roadmap step by step, deploying each version
with patch notes. Scope and completion gates remain in
[the roadmap](2026-09-05-v1-1-to-v1-10-roadmap.md); individual hotfixes do not close
the whole goal. Started September 5, 2026.

## Alpha 1.0.2 — rewards and roads that meet

Status: pushed as `89dad70db593ac8509eeef5e0506e796e0aec212`; CI run
`33986072901` completed successfully, including server/client tests, anonymous
browser smoke, disposable full-character QA, both deployments, and live
anonymous/persistent-character/four-class/remote-animation QA.

Changes:

- Publish pending explicit wizard/daily quest conversations and quest rewards:
  gold plus XP, with max-level XP and level-cap overflow going into Resonance.
  Authoritative receipts preserve the exact split through persistence/protobuf.
- Publish the shared overworld projectile-boundary correction for Air and Fire.
- Replace independently overlapping room/corridor/corner floor assembly with
  an exact partition of the server's walkable rectangle union. Emit masonry
  only on exposed boundaries, preserving intersections, holes, and rectangular
  rooms. Align floor textures across partitions with one material and origin.
- Retain the existing room dressing and legacy fallback layouts.
- Synchronize version defaults and include the new dungeon geometry browser
  regression in anonymous CI. Historical notes remain intact.

Evidence gathered before final version metadata changes:

- 146 client suites / 2,096 tests passed, including exact floor coverage,
  no internal wall collision, 40 deterministic rectangle-union seed fixtures,
  large boss approaches, and the legacy fallback. The randomized fixtures test
  the surface algorithm; they are not a sweep of actual server dungeon seeds.
- Hardware browser geometry fixture passed at High/Low; inspected the reframed
  overview. The generated approach has one floor per sampled point, one floor
  material, and no collision corrections along its center-line route.
- Existing isolated real-server Verdant entry/recall test passed on the initial
  baseline. This does not reproduce or resolve the reported exit failure.
  The helper is now stricter: town position, scenery, and cleared dungeon
  collision/layout must all finish, not just the early instance-type update.
- Previous deployed master `f6accbf` has successful CI run `33945080866`, checked
  through GitHub Actions. That is not evidence for the new candidate.

Final candidate checks: the full client suite (146 suites / 2,096 tests), full
server race suite, lint, and whitespace checks pass. The added release-history
assertion and helper checks pass in a subsequent 181-test focused run. The
stricter isolated real-server Verdant entry/return route passes on the candidate
with completed town scenery/collision/position recovery; its disposable Mongo
and API containers were removed by the runner. This remains narrower than
reproducing all reported exit states or playing a full dungeon.

All eight anonymous browser release checks pass, including the new dungeon
geometry fixture. A synthetic 79-rectangle layout produced 157 floor partitions
and 316 wall segments in approximately 10 ms on this host; this is a generation
microcheck, not a multiplayer performance claim.

Independent live endpoint checks on September 5 confirmed both `release.json`
and backend `/healthz` report `Alpha 1.0.2` and the full SHA above; the frontend
entry-point query matches too. This hotfix's publication is verified. It does
not close the broader dungeon repair or milestone gates.

## Alpha 1.0.3 — within reach, safely home

Status: pushed as `2ec04bc94d8b5cd684e7182499172ddd80d1d5df`. CI run
`33987477412` passed server/client/anonymous checks but failed predeploy portal
QA before either deployment. The jump destination was projected before the
camera settled; the retry then inherited the unfinished dungeon visit. The
corrective QA change waits for a visible ground destination and returns the
dedicated character to town after inspection failures or before a resumed run.
This candidate is not yet live; no milestone gate is closed.

Confirmed reproductions and changes:

- Scaled Rustbound Colossus and Hollow Sentinel client bodies stopped melee
  players outside the server's attack range. Replicate the authoritative actor
  body radius through JSON and protobuf, including stationary radius/scale
  changes. Decorative model bounds no longer determine multiplayer collision.
  Real server Fighter/Cleric attacks at the replicated contact boundary damage
  all 22 dungeon bosses plus the four elemental raid bosses and Dark King
  (27 boss types) in focused race tests; client collision and production
  synchronization tests pass. Browser picking, kills, and quest credit remain open.
- Recall/respawn during an old charge retained dungeon destinations and height,
  moving the player away from the town spawn on the next update. Reset departed
  movement state under the player lock and reject stale movement samples using
  the existing recovery window. Client transitions clear predicted movement and
  queued casts. Generation guards stop late town/legacy dungeon loading from
  overwriting a newer instance. The old failure and repaired next-update positions
  are covered by server/client tests, not yet all live recovery scenarios.
- Actual Wizard Teleport casts in Air, Fire, and an offset dungeon were clamped
  to the old overworld rectangle. Use the current world bounds only outside an
  instance; preserve dungeon walkability constraints inside. Server tests cover
  all four realms and a dungeon at coordinates (20000, 20000).

Final candidate unit checks: 147 client suites / 2,111 tests and the full server
race suite pass. Coverage includes 41 collision/transition tests, 249 focused
version/menu/Wizard checks, 27 boss-contact types, and all 52 selectable abilities
casting inside a registered offset dungeon without displacing the caster or
owned entities into another instance/coordinate space. That last check is not
proof of delayed damage, wall rules, rune variants, or visible effects.
Lint and whitespace checks pass. Login, runtime defaults, and patch history now
identify the local 1.0.3 candidate. The browser portal route now includes real
re-entry and mid-jump recall, with a post-arrival stability check; it is enabled
for both predeploy and live CI. The isolated real-server route passes, including
both returns to Lanternhold with settled scenery, cleared dungeon collision,
stable position, and no remaining jump/charge. Temporary Mongo/API containers
and their data were removed by the runner. Earlier attempts exposed an occupied
development port and two test assumptions (town's existing 0.5m presentation
lift and repeat visits already at maximum zoom); the final run used port 4185
and corrected those assumptions without weakening the recovery-state checks.
All eight anonymous browser release checks also pass on the final candidate.
Publication and exact live verification of 1.0.3 remain pending.

## Dungeon investigations still open

- DUN-01: movement and scene-ordering failures reproduced and repaired locally;
  real-server mid-movement recall, wipe, reconnect, and party variants remain open.
- DUN-02: contact/range mismatch reproduced and repaired locally; mouse picking,
  all-class full combat, boss deaths, loot, and progression still need validation.
- DUN-03: Teleport failure reproduced and repaired locally; remaining abilities,
  rune variants, wall restrictions, presentation, and instance isolation need
  systematic coverage. Neither this nor the projectile fix proves all skills work.
- DUN-04/05: surface construction improved, but actual server seed sweeps,
  multi-dungeon traversal and repeated scene-lifecycle checks remain open.
  Existing layout tests call global `rand.Seed`; inspection of the project's
  Go 1.24.5 standard library confirms that is a no-op by default. They cannot be
  cited as reproducible seed coverage. Add explicit per-layout RNG/seed identity
  and replayable generation checks before claiming the deterministic seed gate.

## Milestone tracking

1.1 remains open until all five dungeon reports meet their acceptance criteria,
alongside onboarding/reconnect and the initial PvP corrections. Releases 1.2
through 1.10 remain unimplemented roadmap work; none is closed by this hotfix.
