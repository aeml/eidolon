# Inventory tooltip text and legacy catalogue qualification

Qualified component source: `1aea5739a127bf05f1094c048c1a9ed5f6c1c2cc`, based on
master `17a5862eca203373d9e004d25fbbfb71f5d5458b`. This component is not yet
deployed. It is selected for the prepared Alpha1.79.82 menu-polish milestone;
the full security review, feature freeze and game-readiness goal remain open.

The actual inventory tooltip inserted item metadata, comparison hints and
unknown socket descriptions into its HTML layout. A saved name containing
markup therefore became an element inside a hint, although the title itself
already used textContent. An unknown set identifier such as `__proto__` also
resolved an inherited catalogue property and crashed on its missing slots.
The separate deliberate item-details path had the same inherited-set crash.
This demonstrates DOM construction and inspection failures with supplied
legacy data; it does not establish a public server-admission bypass or account
compromise.

InventoryUI now escapes scalar text while retaining the existing surrounding
layout, set/effect styles and canonical gem formatting. Gem, set and effect
lookups accept own catalogue entries. MobileItemDetails and the equipment
comparison use the same own-entry policy. Numeric stat/socket totals use a
dictionary without an inherited prototype so own `__proto__` and `constructor`
keys remain numbers. Source items, equipment decisions, dependencies, saved
data and the server protocol are unchanged.

Nine new regressions exercise real InventoryUI tooltip construction and
deliberate descriptions: both hint levels, both comparison panels, unknown
type/slot metadata, socket fallbacks, inherited catalogue aliases, numeric
totals and canonical stat/set/effect/gem presentation. The markup probe is an
inert bold element, not executable content.

Qualification and retained counterexamples:

- The original seven cases against17a reproduced six failures and one pass.
  Four original evidence files retain inventory SHA256
  `58f790a02400f3d4377b1fafe7054bbd6cd96f7d9cd63e5e0a2398faab436a48`.
- The added deliberate-inspection case separately reproduced one failure,
  with eight cases not selected. MobileItemDetails was still byte-identical
  to17a; desktop corrections were already present. Its three-file inventory
  SHA256 is `278b2fd3ed8ba6661c09b32da1d6323fbeb8828192f7746e295cd565884cab32`.
- Final source passes63checks/eight suites in7.172seconds, including all nine
  new cases and existing sorting, buyback, sell-all, mobile inventory, gem,
  equipment-decision and desktop-inspection coverage. Changed-file lint and
  whitespace checks pass. No GPU/native or production request was used.
- Eight final source/log/qualification files retain inventory SHA256
  `061066071a7878da1eb74b30074be62bac6323f9dd6c04bcfcf7b46946305a11`.
  All three inventories were reread and every file size/hash revalidated.

Evidence lives in the owned diagnosis worktree under `.qa-tooltip-text`;
tests in frozen packets use a `.txt` suffix to avoid duplicate discovery.
The separately archived, unexecuted legacy-jump fixture is excluded from this
component. Native assembled menu/gameplay qualification and exact deployment
acceptance remain requirements of the prepared release. This scoped fix does
not close the wider F2 threat/exception ledger.
