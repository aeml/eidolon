# Repository workflow

Completed, validated work must be merged into `master`; do not leave it only on
work or integration branches. Keep `master` synchronized with `origin/master`,
fetch and ordinarily merge remote changes before pushing, and never force-push.
Publish coherent milestones with synchronized release versions and cumulative
patch notes, then verify deployment before publishing another release.

Preserve existing uncommitted user changes. Use an owned worktree when the main
checkout is dirty. Keep unfinished or rejected experiments isolated until they
are reviewed and selected; do not merge them just to reduce branch counts.
