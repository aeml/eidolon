# Earned story-route bag management

Prior11948 run on941ecf6 failed with a full25-slot inventory, not absent quest
drops. Its screenshot visibly shows Memory Seeds on the ground and INVENTORY
FULL. Archive `/tmp/eidolon-story-collection-inventory-failure-OkOJvh` is retained.
The40kill story hunt/manual payout/persistence passed first, leaving25occupied
slots. Collection observed42selected-target deaths with no room for a seed.

The ordinary recovery-enabled story driver now checks bag space between completed
encounters, before starting the existing120s combat watchdog. With fewer than
five free slots it pauses auto-loot through Settings, waits for outstanding
pickups, Recalls normally, and fills eligible empty equipment slots. It then
targets eight free slots by selling only spare Common/Uncommon gear at/below the
character's level and only for already-filled equipment slots. Cheapest Common
items go first. This is a conservative test baseline, not an optimized build.

It never sells quest fragments, crafting materials, gems, relics, Rare+ items,
future-level equipment or worn IDs. If protected items prevent enough room, the
test fails explicitly; it never discards them or grants extra capacity. Merchant
approach, hover, click and each right-click sale use normal game controls.
Compacted inventories are resolved by item ID after every sale. Each receipt
must show exact item removal and quoted gold, with level, quest progress, worn
gear and every unsold item preserved. Actual sale proceeds and visit time are
logged separately from vendor-value estimates. Resume uses normal town departure.

Explicit no-rest diagnostics retain their old behavior and do not silently gain
inventory-driven sanctuary healing. Default normal gameplay has bag management.
No game auto-selling feature, inventory-size/drop/reward change, public-account
mutation or death/deadline bypass is introduced. This is test-driver work.

All story failures now retain bag capacity/free slots and item evidence even
after a login clears the hunt-specific observer, addressing the missing receipt
in the collection failure. No fabricated combat counters are added when absent.

Focused24502 passed28tests/4suites0.945s and lint; logs
`/tmp/eidolon-earned-bag-final-{focused,lint}.log`. Policy tests cover protected
categories/empty equipment slots, minimum-value/stack quotes, exact minimum sale
selection and invalid targets. Wiring checks preserve ordinary inputs and
unchanged watchdog/no-rest policy. Fullclient and actual fresh-story merchant/
collection/training/Imp/wholeEarth playthrough remain required before promotion.
