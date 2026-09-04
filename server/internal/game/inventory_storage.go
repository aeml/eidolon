package game

func (e *Entity) AddItemToInventory(item Item) int {
	remaining := item.Stack
	// 1. Try to stack
	if item.MaxStack > 1 {
		for i := range e.Inventory {
			if e.Inventory[i].ID != "" && e.Inventory[i].Name == item.Name {
				// Self-heal: Update MaxStack from incoming item if it's better (fixes old items)
				if item.MaxStack > e.Inventory[i].MaxStack {
					e.Inventory[i].MaxStack = item.MaxStack
				}

				// Self-heal: Update Icon if missing
				if e.Inventory[i].Icon == "" && item.Icon != "" {
					e.Inventory[i].Icon = item.Icon
				}

				if e.Inventory[i].Stack < e.Inventory[i].MaxStack {
					space := e.Inventory[i].MaxStack - e.Inventory[i].Stack
					if space >= remaining {
						e.Inventory[i].Stack += remaining
						return 0
					} else {
						e.Inventory[i].Stack += space
						remaining -= space
					}
				}
			}
		}
	}

	// 2. Add remaining as new item
	if remaining > 0 {
		// Find first empty slot
		for i := range e.Inventory {
			if e.Inventory[i].ID == "" {
				newItem := item
				newItem.Stack = remaining
				e.Inventory[i] = newItem
				return 0
			}
		}
		return remaining // Inventory full
	}
	return 0
}

func (e *Entity) AddItemToStash(item Item) int {
	remaining := item.Stack
	// 1. Try to stack
	if item.MaxStack > 1 {
		for i := range e.Stash {
			if e.Stash[i].Name == item.Name {
				// Self-heal: Update MaxStack from incoming item if it's better
				if item.MaxStack > e.Stash[i].MaxStack {
					e.Stash[i].MaxStack = item.MaxStack
				}

				// Self-heal: Update Icon if missing
				if e.Stash[i].Icon == "" && item.Icon != "" {
					e.Stash[i].Icon = item.Icon
				}

				if e.Stash[i].Stack < e.Stash[i].MaxStack {
					space := e.Stash[i].MaxStack - e.Stash[i].Stack
					if space >= remaining {
						e.Stash[i].Stack += remaining
						return 0
					} else {
						e.Stash[i].Stack += space
						remaining -= space
					}
				}
			}
		}
	}

	// 2. Add remaining as new item
	if remaining > 0 {
		if len(e.Stash) < MaxStashSize {
			newItem := item
			newItem.Stack = remaining
			e.Stash = append(e.Stash, newItem)
			return 0
		}
		return remaining // Stash full
	}
	return 0
}
