// Match the bag/gear tooltip order everywhere an item's stats are listed.
// Packet/map insertion order is not presentation order: refreshed Forge bases
// can arrive with the same keys in a different order.
const preferredOrder = ['damage', 'defense', 'strength', 'dexterity', 'intelligence', 'wisdom', 'vitality'];

export function orderedItemStatKeys(stats) {
    if (!stats) return [];
    const preferred = preferredOrder.filter(key => Object.prototype.hasOwnProperty.call(stats, key));
    const remaining = Object.keys(stats).filter(key => !preferredOrder.includes(key));
    remaining.sort((a, b) => a.localeCompare(b));
    return preferred.concat(remaining);
}
