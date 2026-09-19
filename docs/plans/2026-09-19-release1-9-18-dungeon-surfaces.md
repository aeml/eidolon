# Alpha 1.9.18 — stone beneath the spelllight

Pushed to master at `74bd4b706022949fc612f1bc91d2e54bb3620b8d`.
Exact CI `35471125941` was queued at handoff to the read-only Luna watcher
`/root/watch_release_1_9_18`. Publication is not yet accepted. Main must not
duplicate its polling; await its failure/terminal report and then verify delivery.

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

## Delivery gate

Delegate exact-SHA CI/CD monitoring to Luna with a minimal brief and terminal/
failure reporting. After success, independently verify public frontend/backend
version and commit, database readiness and served floor source/patch notes.
Do not supersede an active deployment or run local five-browser QA over it.
This patch does not close the remaining1.10 campaign, raid, cross-feature or
physical-phone scope, nor the requested operator read-only admin check.
