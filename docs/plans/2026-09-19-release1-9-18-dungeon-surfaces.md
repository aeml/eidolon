# Alpha 1.9.18 — stone beneath the spelllight

**Delivered and accepted:** Luna reports CI35471538108 terminal success at
`a709d9826726bb0dc60c7298663388847674fec4`. All jobs passed, including predeploy,
both deployments and Live Release and Character QA. The latter took8m18s and
passed anonymous/persistent-character and town recovery/Well Rested checks;
its four-class/remote-animation step was skipped, not newly accepted here.
Independent public frontend/backend identity, readiness, notes and source checks
below match. Earlier pending/cancellation notes retain the release history.

First candidate `74bd4b706022949fc612f1bc91d2e54bb3620b8d`, CI35471125941,
is terminal cancelled before deployment: client checks passed, Go was running,
and every deployment job was cancelled. No live acceptance for that candidate.
The main agent requested cancellation only after Luna confirmed that stage, to
include the canonical-floor integration correction below. The replacement keeps
Alpha1.9.18 and its existing accurate patch notes; delivery remains pending.

Replacement pushed: `a709d9826726bb0dc60c7298663388847674fec4`, exact
CI35471538108 in progress. Luna `/root/watch_release_1_9_18` is reassigned to this
run and must remain watching until terminal, reporting failures without duplicate
main-agent polling. Do not restart the cancelled original or claim this one live.

## Player-facing scope

- Correct sRGB encoding restores the intended stone palette and visible masonry.
- Broader, smoothly filtered floor patterns and subdued decorative glow.
- Water floor pearl speckles removed; elemental wall details remain.
- Room geometry, collisions, enemies, rewards and crystal mechanics unchanged.
- Login, package, client manifest, server/container/deployment and isolated-QA
  versions agree. Cumulative patch notes retain all previous versions.

## Verification retained

-40 procedural interior/crystal tests; changed-source lint/diff checks.
- One targeted native High/Low gallery passes4.4seconds (49305), both screenshots
  inspected. Stone joints now read against the quieter floor; realm wall details
  and objective rings remain. See [visual evidence and limits](2026-09-19-dungeon-floor-readability.md).
-277 version, runtime-import and runner-queue checks pass (12614); changed lint,
  Bash syntax and diff checks pass. No broad gameplay matrix repeated for colors.
- QA-only ranged-spacing correction has101 focused passing checks. Tidestar's
  original guardian and first repair wave were completed, but wave2 was interrupted
  by the recorded crossing-healer input failure. Full raid acceptance stays open;
  see [failure and correction](2026-09-19-tidestar-spacing.md).
- Bundled CI efficiency change skips direct pushes containing only README/docs
  Markdown. PRs, mixed runtime changes and manual dispatch retain their gates.

## Canonical-floor integration correction

Source review found that generated room/corridor union floors set world-space UVs
at a hardcoded12units, bypassing the kit's broader24-unit scale. Shared
`DUNGEON_FLOOR_TEXTURE_SPAN` now drives both paths, with one shared material and
continuous texture coordinates across partitions; non-procedural fallback stays
unchanged. The actual-generator regression failed on the old UVs and passes now.
67 canonical geometry, union, interior and crystal checks pass (43152), plus lint
and diff checks. No room geometry/collision change or new seed sweep.

The single canonical join browser check passes at High/Low in5.0seconds (62666):
no blocked route samples, exactly one floor per interior sample and one shared
floor material. Both screenshots inspected; partition patterns stay continuous.
This foggy synthetic scene is not a claim of actual party readability.
Artifacts: `/tmp/eidolon-floor-join-20260919-7adh4k/`. Reuse the already-required
next raid for integrated actor/telegraph review instead of another broad rerun.

## Delivery gate

Public delivery now independently verified: frontend `release.json` and backend
`healthz` both report `a709d9826726bb0dc60c7298663388847674fec4` / Alpha1.9.18,
with database ready. Served HTML has the1.9.18 login label, its notes and retained
1.9.17 history. Served dungeon artwork contains corrected sRGB encoding and the
shared24-unit span; served WorldGenerator imports that span. Final CI/post-deploy
browser acceptance subsequently passed as recorded above. No native browser job
from this workflow remains active; its slot is available for the next local run.

Delegate exact-SHA CI/CD monitoring to Luna with a minimal brief and terminal/
failure reporting. After success, independently verify public frontend/backend
version and commit, database readiness and served floor source/patch notes.
Do not supersede an active deployment or run local five-browser QA over it.
This patch does not close the remaining1.10 campaign, raid, cross-feature or
physical-phone scope, nor the requested operator read-only admin check.
