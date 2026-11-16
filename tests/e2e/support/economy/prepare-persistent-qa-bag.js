import { freePersistentQALootSlot, readPlayerState, returnToTown } from '../browser/helpers.js';

// Economy assertions need a separate gameplay phase. An ability's ongoing
// attacks can earn ordinary kill Gold while a vendor transaction is in flight;
// that Gold has no room-reward receipt and must never be guessed or tolerated.
export async function preparePersistentQALootSlot(page, options) {
    if ((await readPlayerState(page)).inventoryCount < 25) return [];
    await returnToTown(page, { allowRespawn: false });
    return freePersistentQALootSlot(page, options);
}
