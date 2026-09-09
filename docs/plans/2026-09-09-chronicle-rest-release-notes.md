# The road home — release-note draft

Unreleased, unversioned draft for the coordinated Chronicle, progression and
Well Rested candidate. This is not a live announcement or permission to publish
ahead of canonical releases52–57. Verify the final build and assign its version
before adding these notes to the login-screen history and synchronizing metadata.

## Player-facing notes

### A reason to return to Lanternhold

Town is your place to recover between expeditions. Living characters restore
10% of their maximum health and mana per second inside a safe zone. Ordinary
health and mana regeneration outside safety remains at0.01 per relevant stat
point per second, before applicable bonuses.

Each second spent alive and online in safety also builds one second of **Well
Rested**, up to two hours. Its duration pauses in safe zones and counts down
while you are outside. Logging out neither earns nor spends rest. While active,
Well Rested grants10% increased character stats and25% increased enemy-kill XP;
it does not multiply gold or quest-turn-in rewards. At maximum level, the normal
enemy-XP-to-Resonance conversion still applies.

A golden, elemental mote aura and a readable timer show when you are rested.
The effect respects graphics quality and stays hidden during stealth. Expiring
rest removes its bonuses without refilling your resource bars.

### More to discover in the Fourfold Chronicle

Archmage Ilyra's campaign expands with eight authored investigation chapters
and eight preparation expeditions. Diaries, damaged wards and other records
reveal how Malachar turned the Eidolons' promises of protection against their
own lands. Read the evidence, break the commands carried by his creatures and
return to Ilyra to discuss what you found.

The deeper route remains intact: clear each realm's dungeon to open its raid
road, then finish all four raids and defend each crystal-repair Vigil before
opening the way to the Dark Realm. A dungeon victory does not repair its crystal.
Quest completion stays manual, with Ilyra's reply and an explicit reward claim.

### Progress that belongs to the adventure

Experience requirements and enemy, quest and encounter payouts are rebalanced
together. New story contracts combine longer preparation hunts, collection work
and investigations. Difficulty, party rewards and overlapping boss contracts
are accounted for together instead of piling unrelated XP bonuses onto one kill.
Town recovery is part of this pacing, not an expectation that you fight forever
with depleted health and mana.

Existing levels, earned equipment, gold and completed story access are retained.
Already accepted contracts keep their promised requirements and rewards. New
chapters behind an existing milestone appear as optional catch-up stories rather
than requiring you to earn the same access again.

### Clearer movement and discoveries

On desktop, **Shift + Left Click** means move only: enemies, loot and discoveries
under the cursor will not turn that click into an interaction. Normal clicks
still interact, and Ctrl-click retains its existing jump behavior.

Chronicle inspection sends the latest movement update before its request, fixing
an ordering issue that could reject a discovery just as you reached it. The
server still validates movement, distance and earned discovery credit.

## Publication checks still required

- The corrected Wizard opening/diary/40-kill route passes, including the error
  check, manual rewards and saved progress. Keep that evidence alongside the
  earlier inspection-error failure; complete the remaining class/realm routes.
- Finish earned class/realm progression, party and economy checks. One Wizard's
  successful hunt is not full-campaign, physical-phone or balance approval.
- Reconcile this copy against the exact release diff; retain any documented
  limitations. Do not advertise complete drop/economy balance before it is proven.
- Assign the release version, update login/package/runtime/manifest metadata,
  append the in-game patch-note entry, and pass ordered CI/deployment/exact-live
  verification. The inherited1.0.57 development label is not this feature's version.
