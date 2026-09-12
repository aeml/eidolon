# Cursor healing beneath overlapping enemies — 1.1.0 candidate

## Native result — September 12, 2026

Native36250 on48713d22 passes Rogue28.6s and Cleric24.1s, zero retries.
Rogue pays30mana for Poison Coating. Cleric pays25 for Healing Light (387heal)
and40 for Guardian Embrace (three238heal events); zero rejected casts. Inspected
the Cleric screenshot: overlapping enemies remain present, with the healing
aura and positive heal text visible. Archive
`/tmp/eidolon-healing-cursor-pass-h0JDzB`, scan0/exact containers/image/ports cleanup.
Full refreshed CI34723986784 remains running. These native results verify paid
activation/healing and active-effect suppression, not earned play or performance.

Subsequent arrival status route92442 on48713d22 passes Shadow Lunge39.7s and
Serrated Edges47.5s, baseline/trained/saved ticks, but fails Poison Coating37.5s:
baseline67 passes; trained expects80, observes74. Archive
`/tmp/eidolon-arrival-status-failure-F0VJZM`, scan0/exact cleanup. The test reads
dexterity before aiming, while poison computes its budget at projectile impact;
temporary stat changes are a hypothesis, not a proven cause yet. Preserve the
exact-damage assertions and observe dispatch/impact stats before correcting it.

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
