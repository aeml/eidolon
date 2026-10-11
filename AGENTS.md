# Repository workflow

Completed, validated work must be merged into `master`; do not leave it only on
work or integration branches. Keep `master` synchronized with `origin/master`,
fetch and ordinarily merge remote changes before pushing, and never force-push.
Publish coherent milestones with synchronized release versions and cumulative
patch notes, then verify deployment before publishing another release.

Preserve existing uncommitted user changes. Use an owned worktree when the main
checkout is dirty. Keep unfinished or rejected experiments isolated until they
are reviewed and selected; do not merge them just to reduce branch counts.

Owner branch policy (October 11, 2026): keep only `master` as an active branch,
locally and on origin. Use detached owned worktrees for isolated work. Merge
completed, validated changes into master and remove obsolete branch names.
Archive superseded or unselected histories before retiring their branches;
history consolidation does not select their runtime changes or close readiness
gates. Preserve dirty working trees when detaching their obsolete branch refs.
