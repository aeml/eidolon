# Alpha 1.4.0 — the Fourfold Chronicle

Candidate from1.3 releasefb7554ad, now packaged asAlpha1.4.0 with five player-facing
patch notes and synchronized login/package/runtime/deployment versions. Publication
and exact live identity must still be checked; packaging alone does not prove them.

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

## Witness conversations

- Mara Fen, Dain, Hessa and Selen are now server-spawned non-combat residents in
  the open southern plaza (x=-24/-8/8/24, z=235), facing town. Their four existing
  town-actor silhouettes retain idle animations, with distinct names and no quest
  markers. Normal click/phone USE interaction approaches them and opens dialogue;
  it rejects dead, distant, removed and wrong-instance interactions.
- Sixteen authored topics deepen the four witnesses' beliefs and decisions.
  Each initially offers one topic; two more depend on that player's specific
  recorded field evidence and the final one on the realm's completed raid receipt.
  Counts alone and ready-but-unclaimed raids do not reveal later dialogue.
- Uses the existing responsive quest conversation window, but offers no accept,
  complete, buy or reward action. Quest updates retain the open topic and scroll;
  changing character closes the reading. Speaking to Ilyra restores ordinary quest
  mode. Ilyra remains the sole main-story quest giver.
-33 focused witness/journal tests pass and the targeted Go resident-spawn check
  passes. Changed-file lint/diff pass. Actual390px Chrome dialogue inspected at
  `/tmp/eidolon-1-4-witness-phone.png`:16px text and44px topic targets. Four actual
  NPC models/idle poses inspected at `/tmp/eidolon-1-4-witness-models.png`; the
  temporary gallery initially omitted entity render positioning, corrected before
  that inspection. These fixtures do not claim a complete live-town playthrough.

Final packaging checks:254 version/witness tests PASS, changed-file lint/diff PASS,
and the targeted Go witness-spawn check PASS after its final north-facing rotation.
No additional soak or comprehensive playthrough was started.

Next: publish1.4 and check its deployment. Broader earned progression and physical-device matrices
remain final stabilization.1.3 is deployed on both domains atfb7554ad; final live
QA in CI34730497493 is still running, so its final result remains unclaimed.
