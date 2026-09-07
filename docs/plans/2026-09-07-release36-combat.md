# Alpha 1.0.36 candidate — the reach of your training

Local candidate, **not published**. It follows the repaired 1.0.35 candidate
`948ed0c178c7c5967db078b53ef951d930660f30`; it must not bypass the ordered
1.0.31–35 complete CI/live gates. Package, manifest, login, server/container/deploy
and isolated-QA version defaults advance together. A separate 1.0.36 patch-note
entry is added above, without replacing 1.0.35 or earlier history.

## Included work

- [Range-consumer work](2026-09-07-talent-range-work.md): Teleport/Scorch Beam,
  Arcane Missiles acquisition, Weak Point Mark, Rogue Backstab/Lunge/legacy Strike,
  real enemy bleed/poison ticks and attributed deaths, and Flame Whip's resolved
  radius/arc. Prior implementation checkpoints and their exact tests/gameplay
  receipts are retained in that record.
- [Wizard ground-spell geometry](2026-09-07-ground-spell-talents.md): trained
  placement and separate area, resolved acceptance and cast-time Meteor impact
  replication, along with offline floor/impact/targeting parity fixes.
- [Purifying Wave](2026-09-07-cleansing-area.md): actual talented area and visible
  boundary, enemy/PvP protection, offline self/poison/root cleanse and retained
  shared cooldown. The new isolated phone route is included in the full QA driver.
- The release31 test-only near-death fixture repair is inherited; no production
  combat bypass is introduced by that test repair.

## Final-source validation

The pre-version-change integrated runtime passed 190 client suites / 2,796 tests,
full server race checks (root 27.087 seconds / game 268.765 seconds), lint and the
32.3-second phone route. Versioning adds one patch-note regression test.

The first versioned full client run passed 2,796 tests but failed one layout
assertion that still hard-coded the 1.0.35 login label (148.966 seconds,
`/tmp/eidolon-release36-final-client.log`). That layout check now reads the release
manifest's label; VersionPresentation still independently asserts the exact
1.0.36 label and all version defaults. This is not a relaxation of version alignment.
The corrected full client run passes **190 suites / 2,797 tests in 94.112 seconds**,
`/tmp/eidolon-release36-final-client-corrected.log`. Final lint and diff checks
also pass, `/tmp/eidolon-release36-final-lint-corrected.log`.

Final-source full server race checks pass: root **16.385 seconds**, game and other
unchanged packages reused Go's successful cache from the preceding full run,
`/tmp/eidolon-release36-final-server.log`. No claim of a second uncached game run.

Final 1.0.36 isolated phone cleanse-area gameplay passes **24.8 seconds**
(22.4-second body), `/tmp/eidolon-release36-final-gameplay.log`. Normal Ministry
purchases and actual casts produce the accepted 8m/9.2m High/Low meshes, preserve
cost and survive fresh login/landscape rotation. The final Wizard `ground-shape`
route also passes **34.9 seconds** (32.1-second body),
`/tmp/eidolon-release36-ground-gameplay.log`, retaining blocked-floor rejection,
accepted trained rings/impacts, normal purchases and saved ranks. Both routes pass
credential scans and isolated cleanup; neither is physical-phone or full-party QA.

## Still open

This release does not complete the range/area category, all talent consumers,
offline rune parity, all-class dungeon/raid progression, physical-phone sign-off,
visual polish or the 1.1–1.10 roadmap. In particular:

- Guardian Embrace's periodic area remains a reproduced Ministry defect; the
  diagnostic overlay keeps its failed actual cast/tick visible.
- Purifying Wave's healing-only mastery needs a useful designed benefit; adding
  radius support does not make that investment meaningful.
- Remaining class areas, Rogue ground abilities, actual directional projectile
  travel and duration consumers still require individual tracing and verification.
- Cross-branch combos cannot be called normally available solely because unit
  tests explicitly unlock both skills. Offline Apocalypse's extra meteors and
  broader offline rune/effect parity remain open.

Publication requires this candidate's own CI, deployment and fresh post-terminal
manifest/login/versioned-script/backend identity checks after its predecessors.
