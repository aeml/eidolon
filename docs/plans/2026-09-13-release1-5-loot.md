# Alpha 1.5.0 — loot with purpose

Develop separately from the frozen1.4 release9f4b9dc8. Runtime stays1.4 until this
milestone is packaged. Feature-first work; focused safety checks, no new soak.

## Scope

- Saved build/loadout support with authoritative switching. Start with owned
  equipment IDs and skill-bar selections, then integrate build choices without
  bypassing existing unlock, stat/talent or paid-respec rules. Missing/sold/stashed
  items, full bags, combat/death/instance restrictions and reconnect must not cause
  partial swaps, duplicated items, free healing or lost equipment.
- Appearance collection and selection, separate from actual item combat stats,
  with earned ownership and presentation visible to other players. Preserve
  current equipment identity, socket, potency and upgrade behavior.
- Improve existing Forge/comparison flows. They already have live update and
  readable phone controls; build on those rather than recreating their UI.
- Review quest/raid Gold against equipment/Forge/respec sinks, and Resonance
  rewards against long-term uses. Preserve accepted reward promises and existing
  player progress; do not blindly multiply stats or inflate rewards.
- Define casino Gold transaction/economy safeguards and an interface boundary for
  a separate future VIP currency. Do not name or permanently define that currency.
- Package, publish and verify1.5 with patch notes and a synchronized login version.

## Packaging checkpoint — September 13, 02:56 UTC

Publishing correction: CI34734291355 stopped on two old starter-daily assertions
expecting100 Gold. The authored Skeleton content level10 and100 kills now quote
200 Gold; catalog repair fills genuinely missing Gold from that same offer while
preserving accepted XP and kill counts. Updated those exact expectations; focused
daily generation, quote and Gold checks PASS. No runtime change or extra version.
The original run is terminal; publish this correction normally, without rerunning it.

The remaining1.5 implementation is now complete locally. Forge decisions show a
current/+1/bulk stat table, exact gain and material balance, using the existing
server-matched scaling. Potency uses the same readable preview. Comparisons include
socket stats and flag lost/gained set thresholds and special effects, without a
made-up DPS score. Desktop ring/trinket comparison now uses the actual replacement
slot selection. The existing live-refresh path still updates the new table.

Ordinary kill Gold is now10..(2×level+9); elites double that range and bosses keep
the prior10..(10×level+9). New hunt contract Gold doubles; accepted quotes and earned
balances remain unchanged. Weekly/story/boss/room and Resonance budgets were
reviewed against sinks and retained; see the concrete purchasing-power arithmetic
and casino settlement/currency handoff in
[the economy boundary](2026-09-13-economy-casino-boundary.md). No speculative wallet
framework or premature premium-currency definition was introduced.

Focused Gold/quest-quote/weekly economy checks PASS. Forge live refresh and mobile
inventory checks PASS; a missing plain-language potency explanation was restored,
then Forge/decision tests PASS. Changed JS lint/diff PASS. Actual phone comparison
and Forge table inspected in `/tmp/eidolon-1-5-{comparison,forge-decision}-phone.png`.
The preview's broken item icon is from its placeholder icon URL, not a changed
production icon resolver. No broad suite/soak. Next: notes/version packaging,
publish the completed milestone and verify the live commit/version/health.

### Previous detail — September 13, 02:42 UTC

Earned wardrobe collection and appearance selection are now implemented locally.
An explicit Learn owned looks action captures supported base styles/rarity colours
from server-owned bag/stash/equipment items without consuming or changing gear.
The collection survives selling its source item. Selection requires an earned,
slot-compatible look and actual equipped gear; original appearance can be restored.
Changes require safe town/out-of-combat access and use ordinary durable saves.

Private collection and public per-slot appearance maps persist separately from
combat items. Additive protobuf field127 carries only selected looks; equipment
revision triggers appearance-only deltas and resets. Local/remote actors and the
character preview compose render-only item copies, keeping actual stats, sockets,
potency and level untouched. The character-sheet wardrobe has phone-sized controls.

Focused Go wardrobe ownership/stat-preservation/snapshot/persistence/protocol tests
PASS; nine wardrobe/preview/client-contract checks PASS, changed JS lint/diff PASS.
Actual Chrome phone panel and two-model original/earned-look comparison inspected
at `/tmp/eidolon-1-5-wardrobe-{phone,models}.png`. Initial nested-scroll clipping
was corrected by giving the wardrobe natural height within the character scroll
container. No broad suite/soak. Generator reused cached protoc at
`/tmp/eidolon-protoc/bin/protoc` with `/home/aeml/go/bin` on PATH; generated Go/JS
bindings are included. Runtime remains1.4; do not publish partial1.5 yet.

Next: Forge/comparison improvements, quest/raid Gold and Resonance balance against
sinks, and casino Gold transaction safeguards plus the future undefined VIP
currency boundary. Then package/publish/verify full1.5 with patch notes.

### Previous detail — September 13, 02:28 UTC

Saved build switching and last saved/applied skill-bar restoration are now also
implemented locally. Presets capture specialization, canonical talent ranks and
earned class rune selections, not copied combat stats. Apply stages and validates
the whole build and gear operation before charging or mutating anything. Current
level determines unlocks and talent budget. Existing skill points and cooldowns
are not reset, and depleted HP/MP are preserved.

Changing specialization/talent allocation through a loadout requires explicit
confirmation of a server quote using the existing skills/talents/both respec price
formula. Unchanged builds and rune-only changes cost nothing. Existing direct
specialization/rune/reset controls are unchanged. Replay of an already-applied
build does not charge again. Missing gear or invalid points/runes reject the whole
operation without spending Gold. Gold spent is recorded in the respec sink.

The ordinary join/resume snapshot now sends owner-only presets, current build and
the persisted bar; obsolete skills are filtered without moving other slots or
filling intentional empty slots. Client applies the authoritative build before
the bar so subsequent unchanged state snapshots retain it. Listing/saving presets
does not overwrite a manually arranged current bar.

Focused Go core/persistence/initial-state checks PASS; all four classes restore
their legal build and earned base-skill rune with one exact payment. Nine focused
UI/state tests PASS. Changed JS lint and diff checks PASS. Actual 390px Chrome
paid confirmation inspected at `/tmp/eidolon-1-5-builds-phone.png` (54px button).
No broad test matrix or soak. Runtime remains 1.4 until full 1.5 packaging.

Next: earned appearance collection/selection with visible multiplayer equipment
presentation and separate combat stats; then Forge/comparison, economy tuning and
casino currency boundary. Start with `src/art/ProceduralEquipment.js` descriptors,
`Actor.syncEquipmentVisuals`, `proto/state.proto`, item persistence and owner state.
Do not substitute a client-only wardrobe or claim the whole milestone complete.

### Previous detail — September 13, 02:16 UTC

The first loadout slice is implemented locally, not released:

- Three named server-owned gear/skill-bar presets, persisted in character saves
  and hydrated on login. Presets reference existing item IDs, never stat copies.
- Atomic equipment swaps support full-bag replacements and exchanging rings.
  Missing/stashed/sold, duplicated, invalid-slot, stacked or level-gated gear is
  rejected before mutation. Unsupported legacy slots remain recoverable and
  cannot be copied into an active slot. Swaps do not refill depleted HP/MP.
- Save/apply require a living character in safe town, outside instances and
  active/recent combat. Skills are revalidated against current unlocks.
- Rate-limited owner messages use existing per-account serialization and durable
  save journal. Database failure reports the live applied state honestly and
  retains the pending save for ordinary recovery.
- Bag panel supports named slots, explicit overwrite confirmation and server
  error feedback. Phone expansion uses the bag's content space; 44px controls
  and overwrite confirmation were inspected in actual Chrome at 390px.
- Focused Go loadout/core + persistence/handler/protocol checks passed. Fifteen
  loadout/phone-stash UI checks passed; final loading-state guard has a targeted
  loadout-only rerun. Changed JS lint and diff whitespace checks passed.

Next: persist/restore the applied skill-bar selection automatically on reconnect
(saved preset contents already survive); integrate build choices with existing
paid-respec/unlock rules. Then appearance collection, Forge/comparison and economy
scope below. No claim that the entire loadout/build feature or 1.5 is complete.
Current frontend bar changes only on a server-confirmed apply; intentionally
empty bars are not immediately overwritten by unchanged network snapshots.

## Starting evidence

No existing loadout or wardrobe implementation was found in current source.
`Item.ID` is persisted in game/database items. Entity holds inventory/stash arrays,
equipment by slot, an equipment revision, hotbar and talent state. Start by reading
`server/internal/game/inventory_actions.go` (PerformEquip/PerformUnequip),
`equipment_slots.go`, `server/character_persistence.go` and the character repository
before adding a swap operation. Use current loss/ownership safeguards and actual
save paths; a client-only preset is not the requested authoritative feature.
