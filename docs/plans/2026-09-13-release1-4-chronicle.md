# Alpha 1.4.0 — the Fourfold Chronicle

Development starts from1.3 candidatefb7554ad in a separate worktree while that
release publishes. Runtime version stays1.3 until this milestone is packaged.

## Authoritative starting point

`server/internal/game/quests.go` already builds the active catalog with
`expandChronicleHunts(expandChronicleInvestigations(classicChronicleQuestCatalog()))`.
The eight authored realm investigations, world sites, evidence masks and manual
Ilyra turn-ins therefore exist in the inherited source. Do not recreate them
because older roadmap status paragraphs call them unimplemented.

The existing restoration receipts are `chronicle_10_rootheart_raid`,
`chronicle_11_tidestar_raid`, `chronicle_12_ember_crown_raid` and
`chronicle_13_skyglass_raid`; gate and final battle follow as14/15. Preserve the
dungeon → raid and full raid/crystal-defense → portal sequence, existing progress,
accepted rewards and server-owned completion. New lore must not auto-complete
quests, require repeating a restored crystal, or grant extra currency accidentally.

## Implementation focus

1. Read the current eight chapter narratives and existing conversation/journal
   integration; deepen supporting-character conversations without contradicting
   established events or adding another daily quest source.
2. Add optional lore/follow-up discovery that makes each realm's conflict and the
   Dark King's coercion understandable beyond objective counters. Reuse the
   existing readable phone dialogue/archive surfaces where appropriate.
3. Show visible restoration consequences at the relevant world sites after the
   corresponding authoritative crystal-restoration receipt. Distinguish personal
   story state from shared-world state; retain colliders, interactions and routes.
4. Package1.4 with patch notes and a synchronized login/runtime version, deploy,
   and check exact live identity and a short relevant smoke.

Use focused changed-behavior checks. Full earned progression, physical-device,
equipment and party matrices remain final stabilization under the feature-first
instruction; source catalogs alone do not prove those playthroughs passed.

## Implemented locally

- Read all eight active investigation narratives and the existing site model,
  inspection and journal paths. Their core story is coercion disguised as safety:
  Mara's shared shelter, Dain/Tovin's freely kept promise, Hessa's release of
  controlled fire, and Selen's refusal of an unchanging horizon.
- Each realm's investigation landmarks gain distinct personal restoration
  scenery only after its completed raid receipt: new Earth growth, Water crossing
  cloths/ripples, Fire kiln warmth/pots/new growth, and Air moving pennants/red
  thread. Historical ruins, investigation masks, beacons, collisions and open
  approaches remain. This does not remove shared hazards or alter other players.
- Four optional “After the Vigil” journal records explain the restored covenant
  through those witnesses. Existing collapsible record controls retain open state
  across updates. Ready-but-unclaimed quests reveal neither scenery nor prose;
  a different character does not inherit either. No new reward or completion path.
-55 focused ChronicleSite/QuestUIChronicle tests pass; changed-file lint/diff pass.
  Actual Chrome four-house before/after scene inspected at
  `/tmp/eidolon-1-4-restoration-scenes.png`. Water cloth contrast/position was
  refined after that first look, then visually rechecked. This is an isolated
  scenery check, not a complete earned raid run or phone performance claim.

Next: optional conversations with the people behind the diaries. Keep Ilyra the
story quest giver; reuse readable conversation/journal surfaces and gate spoilers
on the player's existing recorded discoveries/restoration receipts. The eight
investigations and full progression sequence must remain unchanged.
