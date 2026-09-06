// Match the server's stacking rule: stackable items merge by name, whereas
// equipment retains its item id. Occupied-slot count cannot prove a pickup.
export function inventoryQuantity(inventory, item) {
    if (!item?.id || !item?.name) return 0;
    const stackable = Number(item.maxStack) > 1;
    return inventory.reduce((sum, entry) => sum + (entry?.id &&
        (stackable ? entry.name === item.name : entry.id === item.id)
        ? Math.max(1, Number(entry.stack) || 1) : 0), 0);
}

export function pickupReceipt(before, after, item) {
    const previousQuantity = inventoryQuantity(before, item);
    const quantity = inventoryQuantity(after, item);
    if (quantity <= previousQuantity) return null;
    return { item: { id: item.id, name: item.name, maxStack: item.maxStack || 1 },
        previousQuantity, quantity };
}
