# Alpha 1.9.18 — stone beneath the spelllight

First candidate `74bd4b706022949fc612f1bc91d2e54bb3620b8d`, CI35471125941,
is terminal cancelled before deployment: client checks passed, Go was running,
and every deployment job was cancelled. No live acceptance for that candidate.
The main agent requested cancellation only after Luna confirmed that stage, to
include the canonical-floor integration correction below. The replacement keeps
Alpha1.9.18 and its existing accurate patch notes; delivery remains pending.

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

Delegate exact-SHA CI/CD monitoring to Luna with a minimal brief and terminal/
failure reporting. After success, independently verify public frontend/backend
version and commit, database readiness and served floor source/patch notes.
Do not supersede an active deployment or run local five-browser QA over it.
This patch does not close the remaining1.10 campaign, raid, cross-feature or
physical-phone scope, nor the requested operator read-only admin check.
