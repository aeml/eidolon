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

## Implementation checkpoint — September 13, 02:16 UTC

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
