package game

// limitRoutineEquipmentLoot applies only to newly rolled enemy ground loot.
// Existing inventory, personal quest fragments and direct boss rewards do not
// pass through this function.
func limitRoutineEquipmentLoot(items []*Item, isElite, isBoss, qaGuaranteed bool, roll float64) []*Item {
	if isBoss {
		return items
	}
	// Keep the existing material rolls intact. Reducing the whole mixed pool
	// would silently cut hearts/shards as well as gear, worsening Forge supply.
	// Ordinary enemies already roll the pool half the time; retaining 60% of
	// its equipment gives 0.5 * 0.6 * 36/38 = 0.28421 pieces per ordinary kill.
	keepEquipment := isElite || qaGuaranteed || (roll >= 0 && roll < 0.6)
	retainedEquipment := false
	result := make([]*Item, 0, len(items))
	for _, item := range items {
		if item == nil {
			continue
		}
		switch item.Type {
		case ItemWeapon, ItemArmor, ItemAccessory, ItemNeck, ItemGloves:
			if !keepEquipment || retainedEquipment {
				continue
			}
			retainedEquipment = true
		}
		result = append(result, item)
	}
	return result
}
