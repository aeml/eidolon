# Garments: full outfits and distinct VIP models

Owner requirement added October 15, 2026. **Required before beta; not yet
implemented or visually accepted.** This expands the original cosmetic scope.
The existing vendor, unlocks and per-slot appearance pipeline are foundations,
not evidence that this new requirement is complete.

## Appearance behavior

- One armor garment selects a complete outfit, replacing the appearance of all
  worn body equipment together. It must not require separate cosmetic purchases
  or selections for head, chest, shoulders, gloves, belt, legs and boots. Suppress
  any visible underlying gear/accessories that conflict with the outfit.
- Weapon and offhand garments remain independent selections and replace only
  the corresponding held item. An armor outfit must not override either hand.
- Real equipment, stats, class eligibility, attack behavior and earned ownership
  remain unchanged. An empty hand does not gain a weapon from a cosmetic.
- Removing the outfit restores current real gear and any retained individual
  appearance choices. Gear changes made under an outfit must restore correctly.
  Retain old saves and purchased unlocks; do not silently discard old cosmetics.
- Apply the same result in wardrobe/vendor previews, character panels, gameplay,
  remote players and reconnects. Respect legal dual wielding and hand orientation.
- Preserve supplied class bodies, rigs and animation banks. Fit garments to those
  models; do not replace approved actors to make a costume easier to render.

## Minimum model catalog

Current source inventory: `src/core/ItemSystem.js` defines four weapon families
and two dedicated offhand families; `src/core/EquipmentSlots.js` defines four
classes and legal offhand weapon use. Cover every additional family introduced
before beta. The minimum is **18 distinct looks**, plus necessary rig/fit variants:

| Category | Required models | Minimum |
| --- | --- | ---: |
| VIP weapons | Sword, dagger, mace, staff; distinctly designed 3D silhouettes/materials | 4 |
| VIP dedicated offhands | Shield and tome; visibly modeled faces, edges and fittings | 2 |
| VIP class outfits | One full outfit matching each of Fighter, Rogue, Cleric and Wizard | 4 |
| VIP universal outfits | Eight full outfits wearable by every class | 8 |

Weapon garments must also work in supported offhand/dual-wield combinations;
the two dedicated offhands do not replace that coverage. Class-themed describes
art direction, not a newly authorized cosmetic equip restriction.

Proposed universal themes: Christmas/winter festival, Halloween, Valentine's,
Lunar New Year, spring equinox, midsummer, harvest festival and masquerade.
The first three come from the owner; the other five are implementation proposals.
Keep each recognizable and compatible with Eidolon's dark-fantasy presentation.
These are wearable collections, not an instruction to add seasonal scheduling
or limited-time sales.

Each new garment needs actual rendered 3D model geometry with a deliberate
silhouette, fitted details and finished materials. Recoloring the existing item,
renaming an unlock or supplying a concept image does not fulfill model delivery.
Existing elemental cosmetics can be upgraded where appropriate, but their
current palette variants do not count as completed new models. Production and
integration remain implementation work; this request does not assign an
external modeling campaign to the owner. Do not introduce new pricing, payment
integration or membership restrictions as part of this requirement.

## Delivery and acceptance

- [ ] Implement whole-outfit selection, precedence, persistence and restoration
  across current individual cosmetics, underlying gear changes and old saves.
- [ ] Complete a manifest of model IDs, target families/classes, source/provenance,
  material/texture assets, compatible rigs and quality-level budgets.
- [ ] Produce and integrate all 18 minimum models, with all four class fits for
  the eight universal outfits; extend the manifest for new equipment families.
- [ ] Match vendor/wardrobe previews to equipped local and remote appearances;
  retain current server-authoritative ownership and purchase behavior.
- [ ] Review at gameplay and preview zoom, idle/run/attack/cast/dodge/death poses,
  legal dual wielding, High/Low, swapping, pooling, reconnect and scene teardown.
  No floating pieces, exposed underlying armor, broken grips or missing models.
- [ ] Check representative equipped-party rendering/resource costs and bounded
  cleanup. Focused validation continues; soak remains deferred.
- [ ] Complete owner visual review of the finished collection and record scoped
  deployment evidence. Catalog counts alone do not establish visual quality.

## First scoped implementation — October 15

A server-authoritative `outfit` selection now replaces all seven body gear visuals
as one complete model while preserving actual combat gear, independent held
looks and the player's individual appearance choices. Clear restores those
underlying looks. Owned selection, character saves and remote appearance updates
use the existing acknowledgement/persistence rules. Vendor/wardrobe previews
show the same complete model and allow armor-free appearance selection.

The first Fighter-themed Iron Oath Regalia has actual crowned-helm, curved
shoulder-fin and covenant-seal geometry, eight validated skinned GLBs for four
class fits and High/Low, exact asset versions and source provenance. This is
**one distinct look**, not four class-themed looks.121focused client checks,
focused server custody checks, full lint,15content groups and four distinct
native render/vendor cases pass. Corrected prepared party totals are236draws/
191549tri High and124/78191Low; frame-time acceptance is not claimed. Earlier
Low budget/export failures remain in the receipt.
[Qualification](2026-10-15-full-outfit-garment-qualification.json).

Selected locally for the next milestone. The other17minimum looks, wider motion
coverage, final collection review and beta acceptance remain open. Existing
12palette cosmetics still do not count as new model deliveries.

## Isolated held-model candidates — October 15

Six modeled candidates now replace the old palette-only visuals for existing
Grovekeeper Blade/Shield, Skyweaver Dagger/Tome, Hearthkeeper Staff and Tidekeeper
Mace unlocks. Their distinct thornblade, swept crescent, phoenix fork, tide-flange,
oak relief and crescent-bound grimoire forms produce12High/Low GLBs while
retaining all existing IDs/names/prices/ownership and original hand grips.

176focused checks, explicit asset/source audit,12clean official glTF validations
and16content groups pass. **Unselected and isolated**: native art, motion,
preview and resource review is pending ordered56CI completion. No additional
model is counted as accepted yet.
[Preparation and retained fixture failures](2026-10-15-held-garment-preparation.json).
