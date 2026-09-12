# Alpha 1.1.0 release handoff — draft, not release approval

Theme: **A dependable adventure**. This document consolidates release preparation;
it does not replace the [full roadmap](2026-09-05-v1-1-to-v1-10-roadmap.md), mark
its gates complete, or count as published patch notes. The execution ledger owns
live process status. All 1.2.0–1.10.0 requirements remain committed.

## Reviewed patch-note material from accepted components

These entries are ready to carry into the milestone's notes after final combined
acceptance. They are not the complete 1.1.0 change inventory.

- Desktop talent purchases and resets wait for server confirmation, show rejected
  changes and recover after reconnect without displaying unconfirmed ranks.
  Talent cards support keyboard activation.
  [Evidence](2026-09-12-desktop-talent-confirmation.md).
- Removing health-boosting equipment immediately limits current health to the
  new maximum. Equipment changes do not refill health or mana.
  [Evidence](2026-09-12-health-recalculation.md).
- Iron Fortress consistently reduces incoming damage by 20%, alongside its armor
  bonus and movement tradeoff, while preserving training, costs and durations.
  [Evidence](2026-09-12-fortress-mitigation.md).
- Guardian Roar provides consistent 30% incoming-damage protection and displays
  its actual protection strength, replacing the online armor approximation.
  [Evidence](2026-09-12-guardian-roar-protection.md).
- Blade Storm daggers respect their intended flight range and dungeon walls;
  Fine Motor training expands that range and its indicator consistently.
  [Evidence](2026-09-12-blade-storm-area.md).
- Serrated Edges Technique reduces mana cost as well as cooldown. Its previous
  critical-chance bonus did not affect the inherited bleed damage.
  [Evidence](2026-09-12-serrated-technique.md).
- The first dungeon's optional preparation tips explain party roles, suitable
  equipment and town recovery. Expandable menu sections retain native Enter/
  Space behavior without also opening chat or activating an ability.
  [Evidence](2026-09-12-dungeon-preparation-guidance.md).

The [combined regression record](2026-09-12-integrated-1-1-regression.md) identifies
the exact tested integration. Component tests do not independently prove a full
dungeon clear, first-hour pacing or production delivery.

## Material still requiring acceptance or inventory review

- First-dungeon preparation guidance is accepted and merged from cf7f67a1 after
  full CI34722166310 on c09248c8 and desktop/phone screenshot inspection.
  Combined CI34723609678 now passes on802d216a.
- Tripwire damage/training repair: preserve its separate gameplay proof, but
  finish collateral status checks before integration. Shield and prepared
  Rogue/Cleric support checks pass; the latter required the cursor-healing fix
  in48713d22. Retain its draft note once full component acceptance is complete.
- Delayed attack/PvP completion concurrency: candidate03aef5b2 fixes a race
  found by actual2v2 combat under the race detector. Repeated focused checks
  pass, but full CI34724352226 and integration remain pending. Do not describe
  all PvP as accepted based only on the earlier complete CI pass.
- Inventory all other accepted development changes against the current published
  baseline: expanded Chronicle/investigations and pacing, dungeon mechanics,
  remaining class training, phone presentation and multiplayer behavior. Carry
  only verified, actually included player-facing changes into the final notes.
- Do not present QA-only Uncommon/Rare party loadouts as a player loot change.
  Do not include the withdrawn level-based stat curve or unaccepted provisional
  Verdant boss-health reduction.

## Release acceptance checklist

- [x] Complete the current four-role Verdant route: all rooms/bosses, every
  member's kill credit/XP, independent manual Ilyra reward, Water offer and
  saved state/reward checks after relog. Native15051 passed58.8minutes on9b6745d7,
  one prepared Normal level30 seed, with zero deaths. See the
  [exact acceptance scope](2026-09-12-party-progressed-gear.md); this does not
  close the broader dungeon or earned-progression requirements below.
- [ ] Complete the roadmap's five dungeon defect checks across required dungeon
  families, classes, difficulties, seeds and party/death/reconnect scenarios.
  Preserve failing seeds and verify exit/re-entry, geometry and abilities.
- [ ] Finish earned first-hour/Earth progression on the current reward balance,
  using all four classes and relevant group play. Prepared levels and perfect
  selected equipment cannot establish earned progression or loot pacing.
- [ ] Verify resource persistence with equipment-modified maxima, depleted/full/
  dead states, repeated reconnect, autosave/disconnect and instance recovery.
- [ ] Close the broader talent-consumer acceptance, including working effects,
  saved investments and truthful descriptions; do not substitute metadata checks.
- [ ] Verify the usable-phone baseline, including touch-only core flows,
  portrait/landscape, combat readability and the player's physical-phone feedback.
- [ ] Locate or complete evidence for 1.1's duel reward/rating correction and
  team-elimination 2v2 behavior. These must not be lost behind the dungeon work.
- [ ] Close all other 1.1 roadmap gates; this handoff is not a narrower definition
  of the milestone. Resolve any remaining release-blocking regression.

## Publication sequence

1. Reconcile accepted development work with the latest published `origin/master`.
   Preserve published fixes and all existing patch-note entries, including
   1.0.63–1.0.65, which the historical development baseline does not list yet.
   Do not push the root ledger branch or replace published history.
2. Complete the change inventory above and add the accurate 1.1.0 entry to the
   actual in-game/login patch-note history in `index.html`. Planning prose alone
   is not fulfillment of the patch-notes requirement.
3. Synchronize login/client/server/package/release identities and cache/version
   references for 1.1.0; update version-presentation tests without dropping checks
   for older releases. Do not bump these labels while acceptance is incomplete.
4. Run the complete appropriate combined automated, native, visual, gameplay,
   backup/rollback and performance checks on the assembled release revision.
   A manual development workflow with skipped deployment jobs is not a release.
5. Publish the verified release through the normal serialized master workflow.
   Check all required deployment and post-deploy jobs, then independently verify
   exact frontend/backend commit and version identities on the live domains.
6. Perform live login, saved-character, combat, dungeon and reconnect smoke using
   approved QA accounts. Confirm notes/login identify the delivered release and
   record evidence before closing 1.1.0 and advancing to 1.2.0.
