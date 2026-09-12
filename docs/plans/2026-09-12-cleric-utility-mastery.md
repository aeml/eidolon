# Cleric utility Masteries — reproduced, not repaired

On accepted integration8500bdf4, paired ordinary rank0/rank5 paid casts confirm
that three advertised power Masteries do not improve their recipient effects.
The isolated diagnostic36134 exits1/game1.163s (test1.07s):

- CLR_19 Blessing of Resolve: recipient defense120 at both ranks.
- CLR_21 Blessing of Zeal: movement11.52 and attack interval1.465201465201465
  at both ranks.
- CLR_23 Mark of Weakness: vulnerability factor0.20 at both ranks.

All six casts are accepted, spend the proper35/35/30mana, start cooldowns and
apply their actual positive buffs/debuff. Identical recipient base stats/gear
are used for each rank comparison. This is stronger than a missing metadata
reference: the useful effect itself remains unchanged after five ranks.
Log `/tmp/eidolon-cleric-utility-mastery-red-20260912.log`.

The failing test remains on separate work/1-1-cleric-utility-mastery, not accepted
integration. No game runtime, saved rank/ID, stat scaling or version changed.

Next repair should make the promised power affect the actual buff/debuff bonus,
with bounded potency and unchanged untrained behavior. Preserve saved IDs/ranks,
recipient ownership, multiplayer/offline parity, expiry/recalculation, costs,
area/relationship rules and truthful UI descriptions. Verify legal purchases,
actual recipients and saved investments before acceptance; changing text alone
does not restore the missing benefit. This is required1.1 talent-consumer work,
not a full160-talent completion or a new1.0.x release.
