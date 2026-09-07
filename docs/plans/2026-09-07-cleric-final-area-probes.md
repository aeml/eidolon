# Remaining Cleric cone and Healing Light area consumers

Diagnostic expansion after the 1.0.39 phone work. These are open failures, not
implemented fixes or a completed talent audit. Run `npm run audit:talent-consumers`;
the explicit overlay remains separate from the normal passing release suite until
the fixes and their full regression coverage are promoted.

The original paired probe still reproduces ignored `CLR_34` area training for
Radiant Strike, Beacon and Mass Revival. The expanded actual-dispatch probe now
uses ordinary branch selection and, for Mass Revival, a real Divine Intervention
→ Healing Light sequence. Only the fixture's global-cooldown clock is advanced;
no `ActiveCombo` flag or cross-branch unlocked-skill list is granted in that probe.
Prepared level/ranks are still unit-test conditions, not earned progression.

## New evidence

`/tmp/eidolon-cleric-accepted-area-probes.log`: both diagnostic families complete
in **0.595s** with expected failures. The expanded nine cases establish:

| Variant | Rank 0 radius | Rank 1 radius | Rank 5 radius | Shape |
|---|---:|---:|---:|---|
| Radiant Strike | 3 | 3.09 | 3.45 | 120° cone |
| Beacon | 5 | 5.15 | 5.75 | Circle at the selected healing target |
| Mass Revival | 20 | 20.6 | 23 | Circle at the caster |

Rank-zero boundary effects work, including Mass Revival through normal branch-A
casts. Rank-one/five trained boundaries do not. Every emitted ability event has
zero radius/arc, even at rank zero, so remote presentation cannot use an accepted
cast shape. Beacon is tested at a target eight units away from the caster to
distinguish target-centered from caster-centered healing.

This strengthens the previous manually activated Mass Revival fixture: its combo
is reachable through the normal same-branch sequence. Other cross-branch combo
access issues remain separate; this does not prove those builds are usable.

## Next implementation

Use the shared trained-area resolver for all three consumers. Preserve cone
direction, radius/body padding, target relationships, immunity, death and dungeon
cover. Publish exact accepted radius/arc and the correct healing center, and make
client intent/presentation consume it rather than guessing current remote ranks.
Retain direct single-target healing when neither Beacon nor Mass Revival applies.
Review offline Cleric healing/damage consumers and actual local/remote casts as
part of that change; the current offline Healing Light and Radiant Strike branches
still have separate legacy calculations. Do not close the wider combat/phone or
1.1–1.10 gates with these nine probes alone.
