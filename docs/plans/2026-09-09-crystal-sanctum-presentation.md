# Crystal sanctum presentation candidate

Update12:47UTC: bespoke Maelin and her server-driven ritual loop now have focused
and actual rendered proof; see `2026-09-09-maelin-channel-and-model.md`. Earlier
pending-model statements below are historical. Full group/transport/live gates
and further room/floor art refinement remain open.

Status: implemented in the later story worktree; excluded from Alpha 1.0.58.
Not deployed. Initial rendered inspection is complete, but final art/gameplay
approval and full regression remain required. The existing clothed Wizard rig
still stands in for bespoke Maelin.

## Rendered inspection — September9,12:27UTC

Full regression47504 subsequently PASSED on aa4f0f1: client273suites/3909tests/
83.194s plus lint, then fresh fullGo-race root19.472s/game243.181s/database1.295s.
Logs `/tmp/eidolon-primary-crystal-full-{client,lint,server}.log`. Full local
regression is complete for this code, but earned group/rejoin/live gates remain.
A read-only actual remote CrystalKeeper tick additionally reproduced the missing
ritual pose: stateCHANNELING requestsIdle. Log
`/tmp/eidolon-maelin-channel-source-probe.log`; fix is still pending, with bespoke
Maelin. The visual fixture above did not claim to prove a channel animation.

66202actual browser PASS8cases/22.5s on3587363; each captured three states in
High/Low at desktop and portrait phone sizes. Archive
`/tmp/eidolon-crystal-visual-first-proof-EfFXcC`; log
`/tmp/eidolon-crystal-sanctum-browser.log`. All eight restored captures inspected.
The elemental shapes rendered, but the pre-existing broad spirit-material boss
ring overwhelmed Maelin and the crystal under bloom. Passing pixel checks did
not make that acceptable presentation.

d81c9c7 replaces only `crystal_vigil`'s decorative boss ring with a narrow metal
inlay and lowers crystal emission to retain visible facets. Ordinary boss dressing
and objective/clear state markers remain.20130initial focused failed on the
new ninth shared shape count and an incorrectly assumed boss exit-portal fixture;
both assertions were corrected (entry rooms own that portal). Final focused
PASS42tests/3suites/1.625s plus lint; logs
`/tmp/eidolon-crystal-visual-glare-{focused-r2,lint-r2}.log`.

64594actual corrected browser PASS8cases/22.3s; all48state/quality screenshots
retained at `/tmp/eidolon-crystal-visual-glare-proof-FVvi7I`, scan0 and port41961
cleanup verified. Log `/tmp/eidolon-crystal-sanctum-browser-r2.log`.
Inspected corrected Earth/Air desktop restored, Fire desktop fractured, and Water
phone Low repairing: ring glare is gone, cracked versus aligned facets are visible,
the ritual thread is thin and Maelin is no longer covered by the bloom ring.
This is controlled GPU/scene proof, not full earned group progression.

Open visual refinements include bespoke Maelin/ritual pose, quieter repeating
floor patterns and fuller sanctum architecture beyond the new reliquaries. Test
actual player-camera scale and encounter telegraphs with a full raid, plus durable
rejoin transport. Those are not closed by these overview presentation fixtures.

## Implemented

- Four realm-specific reliquaries: Rootheart's root buttresses, Tidestar's tidal
  arches, Ember Crown's obsidian teeth, and Skyglass's suspended orbital frame.
- A three-section closed hexagonal crystal whose fractures align as authoritative
  repair progress advances. Restored sections form one outer surface, not three
  intersecting whole gems. Elemental color replaces the corrupted violet.
- A thin ritual thread from Maelin's defense center, restrained orbital motes,
  and a low floor inlay. The altar is32units behind the authoritative chamber
  center so the guardian/Maelin central approach stays clear.
- High/Low detail switches live: Low hides fine filigree and uses6instead of12
  instanced motes. No added collision or raycast targets; no enclosing glow.
- The actual WorldGenerator consumes only a matching instance/type/element/chamber
  snapshot. Old-instance updates cannot restore the current crystal. Missing
  authoritative state hides it; returning valid state reuses the existing root.
  Normal scene ownership disposes its geometry/materials during instance teardown.
- Raid lighting now resolves by raid identity, not remote allocation coordinates.
  The four elemental raids use their matching dungeon atmosphere; the weekly Dark
  Realm raid uses Umbral Nexus. Unknown/overworld behavior remains unchanged.

## Evidence and remaining gates

Initial focused76605 had5fixture/assertion failures: JavaScript negative zero in
four exact rotation comparisons, and a handler harness missing its required player.
These were corrected without changing production geometry/state checks. Retain
`/tmp/eidolon-crystal-visual-focused.log` as failed, not a product regression claim.
57283passed56tests/4suites/2.735s plus lint under Node24.18.0:
`/tmp/eidolon-crystal-visual-focused-r2.log`, `...visual-lint-r2.log`.

The actual raid-lighting regression failed all five new cases before the fix,
because their remote coordinates selected an overworld atmosphere:
`/tmp/eidolon-raid-lighting-before.log`.
29937expandedPASS84tests/6suites/3.025s plus lint, including actual room-state
message dispatch into real WorldGenerator/art and existing dungeon containment.
Logs `/tmp/eidolon-crystal-visual-expanded{,-lint}.log`.

8603lint/discovery passed for eight browser cases in
`tests/e2e/crystal-sanctum-presentation.spec.js`; subsequent runs are recorded above.
They use actual regional room generation, RenderSystem, the snapshot consumer and
CrystalKeeper actor, and capture each state at1280x720and390x844inHigh/Low. An actual
GPU hidden/visible comparison must prove the crystal contributes pixels, not just
exists in a scene graph. Screenshots still need human visual inspection.
Logs `/tmp/eidolon-crystal-visual-browser-{lint,discovery}.log`.

These fixtures do not prove earned raid progression, live/rejoin transport, full
group telegraph readability, physical phone performance, or final art quality.
Finish those gates, design bespoke Maelin/ritual motion, and complete full server
and client regression before assigning/publishing the later story version.

## Planned player-facing patch notes

Elemental raid crystals now visibly fracture, align during each defense wave,
and shine with their restored element when the ritual is complete. Each realm
has its own crystal reliquary. Raid lighting now matches the realm, and Low
graphics reduce the ritual's fine detail. Crystal restoration still requires
finishing the defense; quest rewards remain a manual turn-in with Ilyra.

Publish this entry only with the eventual accepted story release, not1.0.58.
