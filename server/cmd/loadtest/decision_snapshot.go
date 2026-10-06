package main

// Caller holds stateMu. Casino control needs only the separately copied own
// entity and its own casino view, never the combat map or sale inventory.
// Keep the existing detached shallow copies for every other controller.
func copyDecisionDetails(entities map[string]Entity, inventory []Item, casinoOnly bool) (map[string]Entity, []Item) {
	if casinoOnly {
		return nil, nil
	}
	current := make(map[string]Entity, len(entities))
	for id, entity := range entities {
		current[id] = entity
	}
	bag := make([]Item, len(inventory))
	copy(bag, inventory)
	return current, bag
}
