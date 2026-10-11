# Repository workflow

Completed, validated work must be merged into `master`; do not leave it only on
work or integration branches. Keep `master` synchronized with `origin/master`,
fetch and ordinarily merge remote changes before pushing, and never force-push.
Publish coherent milestones with synchronized release versions and cumulative
patch notes, then verify deployment before publishing another release.

Preserve existing uncommitted user changes. Use an owned worktree when the main
checkout is dirty. Keep unfinished work isolated in detached worktrees. Archive rejected or
superseded histories before retiring their branch names; history consolidation
must preserve the selected runtime and does not qualify unfinished features.

Owner branch policy (October 11, 2026): keep only `master` as an active branch,
locally and on origin. Use detached owned worktrees for isolated work. Merge
completed, validated changes into master and remove obsolete branch names.
Archive superseded or unselected histories before retiring their branches;
history consolidation does not select their runtime changes or close readiness
gates. Preserve dirty working trees when detaching their obsolete branch refs.
