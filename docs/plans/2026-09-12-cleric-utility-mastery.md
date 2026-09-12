# Cleric utility Masteries — implementation complete, focused checks passed

## Delivery under revised feature-first policy

Server recipient potency now travels through snapshot comparison and both full/
delta protobuf messages (new fields124–126); unchanged or inactive potency does
not produce spurious updates. Heaven's Trumpet retains its separate50% mark.
Local/remote clients display received power without reapplying stat multipliers.
Offline Resolve now uses defense, not the old25% direct reduction; Zeal uses
20% movement/30% attack speed before Mastery, with one derived-stat application,
recipient-owned expiry and purge cleanup. Buff descriptions reflect those effects.

Focused verification: server wire/race suite passes (main1.129s, game4.831s);
initial client wire25 tests pass2.403s; final relevant client108 tests pass3.414s.
Changed client files pass ESLint; diff checks pass. Logs:
`/tmp/eidolon-cleric-utility-wire-race-20260912.log` and
`/tmp/eidolon-cleric-final-focused-20260912.log`.
The preexisting tracker assertion expected obsolete reduction/damage/healing
text; it now expects the implemented defense/movement/cadence descriptions.

Accept for integration using the player's revised proportionate-verification
policy. Broad rendered/saved-purchase matrices move to final stabilization;
they are not claimed passed. No dedicated full CI or new long native run is
required for this isolated fix. Normal release smoke and data-safety checks
remain. No production deployment/version bump yet.

Draft patch note: Cleric Resolve, Zeal and Mark Masteries now strengthen their
actual bonuses; online/offline blessing effects and buff descriptions agree.

## Server implementation — September 12, 23:32 UTC

Named caster ranks now snapshot bounded power onto recipients: Resolve grants
20%→24% defense, Zeal grants20%→24% movement and30%→36% attack speed, and Mark
grants20%→24% incoming-damage vulnerability at rank0→5. The multiplier applies
to the bonus only. Generic damage training and recipient ranks do not amplify
it. Saved IDs/maps remain untouched; invalid/legacy blessing power falls back
to the ordinary bonus. Both entity copy paths retain potency/deadlines. Recasts
replace rather than stack strength; expiry and Zeal purge clear stored power.
Untrained server costs, durations, relationship and targeting rules are unchanged.

Original missing-effect probe now passes. Expanded paid rank0/1/5 checks,
bounded/foreign-class inputs, legal five-rank purchases and sixth-rank rejection,
recipient ownership, actual Mark damage, recasts/copies and expiry pass together
with existing Cleric, support-deadline, targeted dungeon-wall and Fighter purge
regressions: session57512 TERMINAL PASS, game25.274s under the race detector.
Log `/tmp/eidolon-cleric-utility-server-final-20260912.log`.
Earlier expanded checks correctly exposed two fixture assumptions: the compact
broadcast copy excludes the internal attack timer, and the raw enemy fixture
had not derived its baseline stats. Tests now assert actual live attack timing
separately and derive the enemy baseline before comparison; potency, copied
cadence, actual damage and expiry assertions remain exact.

This is an isolated server candidate, NOT accepted or integrated. Required next:
JSON/full-delta/protobuf potency replication and tests; offline effects and
truthful UI parity; trained NPC/purge coverage; saved purchases and real rendered
recipients; full CI and combined acceptance. Offline currently uses incompatible
25% Resolve damage reduction and35% Zeal attack speed, with misleading Zeal
damage/healing text. Reconcile to canonical server defense/movement/cadence,
explicitly documenting this parity correction rather than claiming both old
baselines were preserved. No version or production deployment changed.

## Original reproduction

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

The original failing test was committed on separate work/1-1-cleric-utility-mastery, not accepted
integration. No game runtime, saved rank/ID, stat scaling or version changed.

Next repair should make the promised power affect the actual buff/debuff bonus,
with bounded potency and unchanged untrained behavior. Preserve saved IDs/ranks,
recipient ownership, multiplayer/offline parity, expiry/recalculation, costs,
area/relationship rules and truthful UI descriptions. Verify legal purchases,
actual recipients and saved investments before acceptance; changing text alone
does not restore the missing benefit. This is required1.1 talent-consumer work,
not a full160-talent completion or a new1.0.x release.
