# Alpha1.25 — Air journey preflight

Local integration, not yet accepted. Exclude these files from1.23 and1.24 publication:
`airQuestSearch.js`, `AirQuestSearch.test.js`, `AirLandmarkGeometry.js`,
`AirLandmarkGeometry.test.js`, the new AtlasQuestMarkers/ProceduralElementalLocations/
atlas-navigation changes and this document. Fire is separated in local commit
b1a3ae67. Publish milestones in order.

## Observed navigation gap

The current Air region-center marker2000,200 happens to match the Thunder Roc
sector for The Hours We Refuse to Lose. It also directs Stormglass Pinion
collection there, despite nearer eligible Storm Harpies beyond the eastern
passage. The new helper retains the Roc center, narrows each enemy's search
area to its authored spawn strip, and starts Pinion collection at1200,200.
Instructions distinguish overworld hunting from Tempest Spire admission,
chance drops from guaranteed rewards, and waypoints from safe routes.

Three direct helper/source-contract tests pass2.14s; scoped ESLint passes.
These initial checks were not atlas integration evidence. The helper is now
wired into the runtime atlas, with an additional manual turn-in, guide/dungeon
marker and level80-copy test.23 combined search/geometry/population/atlas cases
pass9.159s; scoped lint and whitespace pass. The desktop/portrait browser review
includes actual Roc and Pinion selections and waypoints; both passed26.0s/23.1s.

## Observed Orrery visual defect

Inspected the existing High capture at
`/tmp/eidolon-air-dark117-final/populated-earth-world-populated-Air-high-at-1280px/horizon-orrery.png`:
the12m-centred6m rings are cropped by the normal camera and overlap into a
single plain hoop. A flat bevelled instrument-band helper is prepared for
three distinct ring planes, radii4.5/3.9/3.3 and centreY8. This keeps the lowest
possible ring above3.4m and the crown below12.6m. Two High/Low geometry tests
pass2.201s, with finite vertices/normals and bounded triangle counts; scoped
lint passes. Runtime integration now retains the two4×2×4 ground plinths atZ±12,
connects lowered supports and pivots, adds24 dial graduations, and replaces the
large sphere with a small faceted core and two axis markers. No new material,
light, per-frame allocation or blocker under the rings. Both Air scenery cases
passed15.0s/11.2s. Final High/Low Orrery and portrait collection-map captures were
inspected in `/tmp/eidolon-125-air-review/`: the crown fits, three ring planes
read distinctly, and the hero/central approach remain clear. Portrait map copy,
waypoint controls and map remain usable. This bounded four-case review took1.3m
and deliberately does not claim a new frame budget under current heavy host load.

## Journey and combat review boundaries

- `spawnAirRealm` owns five strips, Storm Harpy70+ through Cyclone Avatar90+;
  server entities spawn atY0. Do not infer elevated combat planes from sky art.
- Authored sequence: Selen's journal1150,245;30 Thunder Rocs80+; eight Pinions;
  silent vane, trapped updraft and free horizon marker; Zephyrion; separate
  Skyglass Eyrie raid. Review the effective conversation handoff (the hunt
  catalog overrides the predecessor's older completion copy), not JSON alone.
- Tempest's real entrance is2400,200. `dungeon_progression.go` requires70;
  the80+ hunt condition does not change dungeon-family admission. Existing
  character/story eligibility still applies. No level/count/reward changes.
- `projectile_realms_test.go` explicitly exercises Wizard Fireball and Rogue
  Piercing Throw at Air1010,200 and2850,200, checking accepted cast, projectile
  existence, no immediate cull and actual target damage. A focused rerun of
  that test plus outer-bounds/instance-exemption checks passed1.111s on this
  worktree (`GOMAXPROCS=2 go test -p 1 ./internal/game -run
  '^(TestPlayerProjectilesTravelAndHitInEveryOverworldRealm|TestProjectileOuterBoundsAndInstanceExemption)$'
  -count=1`). This is server behavior, not browser visibility proof.
- Existing projectile visual tests cover every production subtype and finite
  entity transforms; review actual Air aim/render evidence before claiming the
  full milestone. Preserve earned Tempest clears; do not replay a full raid for
  a version label. No speculative physics rewrite without a demonstrated defect.

`getIlyraCompletionReply` was inspected: non-optional predecessor quests use
`huntHandoffs` before the older investigation completion, while optional veteran
chapters retain retrospective text. Existing conversation tests cover the Air
predecessor and collection transitions. No dialogue change is warranted by the
older raw JSON copy alone.

## Bounded Air aiming/projectile presentation check

The existing Air scene review now adds native right-click aiming at1010,200 and
2850,200, constructing the production Fireball visual from the ground-plane
intersection at the server's1.5m flight height. Both High1280px and Low390px cases
passed17.4s/13.3s (34.3s total); aim error stays below.25m, the projectile travels
5m in.25s, remains active/visible and projects inside the camera frustum.
Final High far-reaches and Low entrance captures were inspected:
`/tmp/eidolon-125-air-projectiles/`. The fireball is visibly above the floor and
distinct from the scenery. No projectile production code change was warranted.
The fixture's InputManager now receives the actual scene and canvas separately.

This is deliberately an input/render fixture with a contextual Fighter model,
not a real Wizard/network cast, mana/cooldown test or authoritative enemy-hit
receipt. The separate Go regression above proves accepted Wizard/Rogue casts,
travel and damage at these positions. Combined scopes are recorded explicitly;
neither is a full campaign or every-skill/every-angle guarantee. No new long
encounter or performance profiling run was started.

Final patch notes/login/runtime defaults are synchronized at1.25 in local
commit63437c99.347 focused packaging checks8.171s, full lint and whitespace pass.
The candidate is not pushed; see the1.25 release record for the public verifier.

Remaining: predecessor
acceptance, publication and exact live verification. Human pacing and final
modern-art approval remain open. No long campaign or soak started.
