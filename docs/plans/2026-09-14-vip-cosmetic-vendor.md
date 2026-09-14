# Veyra’s cosmetic wardrobe — implemented, not yet released

Follow-on to the 1.9.5 EP wallet. Keep the existing deployment run
34795245270 running; do not push another release over it. Package this work in
the next feature batch with its own version and the patch notes below.

## Player-facing patch notes for the next batch

- Meet **Veyra · VIP Outfitter**, beside the casino entrance in Lanternhold.
  Anyone with EP may browse and buy cosmetics; entering the guarded upstairs
  lounge is not required. EP ownership still does not grant VIP membership.
- Browse twelve Earth, Air, Fire and Water looks: four armor appearances at
  25 EP, four weapon appearances at 15 EP, and four shield/tome appearances at
  12 EP. These are initial catalogue prices, not real-money prices.
- Preview a cosmetic on your character, rotate the preview, compare with your
  equipped look, review the EP cost, then explicitly confirm the permanent unlock.
  Owned looks can be applied over actual equipped gear at the vendor or wardrobe.
- These are collection unlocks, never inventory items: no stats, Gold payouts,
  salvage, auction listing or player trade. Your actual gear and progression stay
  unchanged. Duplicate purchase requests never buy an owned look twice.

## Implementation and invariants

- Physical, neutral NPC: server ID vip-cosmetic-vendor, subtype CosmeticVendor,
  position (12, .5, 185), east of the casino approach and clear of the west stash.
  Mouse/phone normal interaction uses the dedicated class, not the merchant menu.
  Server checks alive, safe town, out of combat and within 5m of the real vendor.
- get_cosmetic_vendor / buy_cosmetic / cosmetic_vendor_result are authenticated,
  character-bound, account-serialized, payload-limited and rate-limited messages.
  Purchases require confirmation and the quoted EP price. The server owns prices;
  stale/forged prices, remote requests, insufficient EP and unknown offers fail.
- EP debit and unique AppearanceCollection entry share the existing full-save
  journal transaction. That permanent entry is the idempotent purchase receipt.
  No extra sellable item, transferable currency, receipt TTL or reverse endpoint.
  Reopened-journal recovery retains both the debit and the unlock.
- Selected looks reuse the existing appearance persistence/protobuf/delta path.
  Renderer-only catalogue descriptors are separate from the equippable item
  manifest. Both server data and generated client visual palettes come from
  server/internal/game/content/cosmetics.json; prepare:client regenerates them.
- Preview data never enters the real player’s equipment or network requests.
  Preview renders on changes, not a second animation loop; closing disposes the
  renderer. Dialog also closes on character change, death or leaving the vendor.
  Phone catalogue rows scroll without shrinking text; Close stays visible.

## Focused evidence

- Client catalogue/UI + unchanged procedural-equipment coverage: 212 PASS.
- Server cosmetic access/economy/ownership, handler persistence/reopened-journal,
  wardrobe/protobuf, protocol checks pass. Go build passes.
- Real-browser fixture with actual WebGL character preview, both 390px and1440px:
  2 PASS11.7s. Confirms preview/compare, price review, one purchase, apply, unchanged
  actual gear, readable catalogue rows, accessible Close and preview disposal.
  Screenshots reviewed at /tmp/eidolon-cosmetic-vendor-390.png and -1440.png.
- Focused lint and whitespace checks pass. No soak or broad local suite started.

## Still required for full 1.10

Trusted VIP entitlement, 100 EP per active VIP month, separate EP-only casino
games up to 100 EP, functioning guarded VIP floor, and the remaining consolidated
roadmap acceptance. No billing, checkout or subscription purchase integration.
Preserve 1.9.5 EP fields in any rollback; do not deploy pre-wallet full-save code
after issuing EP. Current single-character account ownership must migrate before
any future multi-character feature can grant additional wallets/allowances.
