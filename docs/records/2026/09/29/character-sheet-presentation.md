# Character sheet presentation — 1.45 candidate

Local continuation after13be004c; no version change, deployment or gate waiver.

- Wide desktop sheets show the equipped preview beside attributes/combat stats,
  rather than making the player scroll below equipment to find their build.
  Narrow desktop retains the stacked layout; phones retain their equipment grid.
- EP/wardrobe disclosures follow the core build display visually. Phone
  attributes use a single readable column; Resonance actions have44px targets.
- Stat updates no longer replace the entire panel. Focused attribute/Resonance
  buttons remain mounted during HP/MP, XP and attribute updates. Existing
  delegated actions and authoritative spending restrictions remain intact.
- Vitals, grouped numerical values and signed base-attribute differences are
  clearer. Missing values show a dash, not undefined/NaN. Level100 shows its
  Resonance progression without a misleading ordinary-XP progress line.
- This is display-only: no stat calculation, item change, local point spending,
  class balance or imported model change.

Verification: initial34 HUD/capped-reward/preview checks passed3.584s;
final34 stats-panel/HUD/capped-reward checks passed3.248s. Six final browser
cases passed46.7s: wide/narrow desktop and phone character fixtures plus
existing360px/390px/landscape phone bag/equipment routes. Stable node identity,
focus, scroll, refreshed numerical values and one keyboard-spend callback are
asserted without changing the fixture's authoritative point count.

Before/after captures inspected at `/tmp/eidolon-character-sheet-before-0929`
and `/tmp/eidolon-character-sheet-reviewed-0929`. These use real UI and the
procedural equipment preview with prepared data, not live progression or
real-phone acceptance. Scoped ESLint and whitespace checks passed.

Three new cases join the existing hosted interface stage;204 required browser
cases have an exact discovered shard union, with no omissions/duplicates.
That verifies partitioning only, not execution of all204 cases this turn.
The actor preview remains visibly procedural; this does not close the modern
character-art target or the remaining1.45 service/menu reviews.
