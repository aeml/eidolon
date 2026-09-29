# Forge presentation and cap states — 1.45 candidate

Local continuation after82a96406; no new release identity or gate waiver.
The earlier authoritative open-Forge refresh already works and is retained.

- Wide desktops get a named, scrollable equipment list beside the selected
  item's cost/stat preview. No need to identify every item from its icon.
- Level100, Potency+20 and four-socket items retain current stats and show a
  clear limit summary. Cost rows disappear, buttons describe the cap and stale
  spending quotes are cleared. A newly selected upgradeable item restores the
  ordinary cost/actions. No costs, success rules or progression changes.
- Action buttons use the game palette, including disabled states. Phone rows
  size to wrapped text instead of clipping metadata at their bottom edge.
- The existing request/response path remains authoritative: a click submits
  the displayed quote; only refreshed state changes item level/materials.

Verification:36 focused Forge UI/live-refresh/progression checks passed2.355s;
new cap checks include actual network-delta application, all three cap states,
blocked stale requests and return to an upgradeable item. Scoped lint/diff
checks passed. Initial desktop/phone browser cases passed16.8s; visual review
exposed clipped phone row metadata. Content-sized rows and a bounding check
for every equipment label fix that issue; strengthened cases passed23.2s.
Final cap-cost visibility assertions also pass; the terminal browser result is
`/tmp/eidolon-forge-reviewed-0929/.last-run.json` (passed, no failed tests),
with desktop and phone upgrade/potency/socket captures in that directory.

Two new cases join the existing hosted interface stage. The required206-case
browser union is verified without omissions/duplicates; this is discovery,
not a claim that all206 cases were executed. No added runner queue or soak.
Fixtures use real UI/CSS/icons with prepared data, not live economic actions.
Remaining1.45 service/menu reviews and final visual acceptance stay open.
