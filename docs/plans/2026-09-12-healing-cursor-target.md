# Cursor healing beneath overlapping enemies — 1.1.0 candidate

Arrival collateral58903 on00b616b0 reproduced the Cleric failure52.2s (Rogue
passes28.8s). Read-only receipts show17 Healing Light requests rejected with
requirements_not_met, zero accepted casts/heals,779/2575HP,1585mana, unlocked
hotbar skills and zero cooldown. Guardian Embrace is never attempted because
the baseline controller prioritizes the still-needed direct heal. Archive
`/tmp/eidolon-arrival-support-diagnostic-failure-bP98ES`, scan0/exact cleanup.

The fresh hotbar path copied the hovered hostile's identity into healing casts.
The server correctly rejects explicit hostile support targets before costs or
cooldowns. Overlapping enemy geometry can therefore intercept a cursor aimed
at the caster. Focused hotbar/direct cursor tests reproduce four failures while
five ally/explicit-intent/offensive cases pass.

Healing Light and Divine Intervention now ignore a hostile hover when deriving
fresh cursor intent, preserving the actual ground point and ordinary server
ally/self resolution. Facing uses the same filter. Explicit roster selection,
captured/buffered identity, ally hover and offensive skills retain their paths;
server target validation, costs, healing strength and cooldowns are unchanged.
No controller shortcut, resource reset or weaker support assertion was added.

Logs `/tmp/eidolon-healing-cursor-{red,green,lint,party-regression}-20260912.log`.
Actual protected support rerun and full refreshed CI remain required. This is
not earned progression or a dungeon-clear acceptance.

## Draft 1.1.0 patch note

- Healing spells aimed beneath an overlapping enemy no longer accidentally
  select that enemy and fail; explicit party healing targets remain respected.
