package game

import (
	"eidolon-server/internal/forging"
	"fmt"
	"log"
	"math"
	"strings"
)

func (w *World) PerformForgeUpgrade(playerID, slot string, amount int, expected ...*ForgeQuote) (*Entity, bool, string) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false, "Player not found"
	}
	player.Mu.Lock()
	defer player.Mu.Unlock()

	// Get item from slot
	item, ok := player.Equipment[slot]
	if !ok {
		return nil, false, "No item in slot"
	}

	if amount <= 0 {
		amount = 1
	}

	// Charge every purchased level at its own tier, independent of batch size.
	if !forgeQuoteMatches(item, expected) {
		return nil, false, "Equipment changed. Review the Forge preview and try again."
	}
	targetLevel, cost := forging.UpgradeCost(item.Level, amount)

	levelsToAdd := targetLevel - item.Level
	if levelsToAdd <= 0 {
		return nil, false, "Max level reached"
	}

	// Check Player Level Requirement
	if player.Level < targetLevel {
		return nil, false, fmt.Sprintf("Player level too low. Need level %d", targetLevel)
	}

	// Check Shards
	shardCount := 0
	for _, invItem := range player.Inventory {
		if isForgeShardItem(invItem) {
			shardCount += forgeInventoryStackCount(invItem)
		}
	}

	if shardCount < cost {
		return nil, false, fmt.Sprintf("Not enough Shards. Need %d", cost)
	}

	// Deduct Shards
	remainingCost := cost
	// Iterate backwards to safely remove empty stacks
	for i := len(player.Inventory) - 1; i >= 0; i-- {
		if isForgeShardItem(player.Inventory[i]) {
			take := remainingCost
			stackCount := forgeInventoryStackCount(player.Inventory[i])
			if stackCount <= take {
				take = stackCount
				// Remove item
				player.Inventory = append(player.Inventory[:i], player.Inventory[i+1:]...)
			} else {
				player.Inventory[i].Stack -= take
			}
			remainingCost -= take
			if remainingCost <= 0 {
				break
			}
		}
	}

	// Upgrade Item
	newItem := cloneItem(item)
	ensureForgeBasis(&newItem)
	newItem.Level = targetLevel
	newItem.Stats, newItem.Value = newItem.ForgeBasis.Scale(newItem.Level, newItem.Potency)

	player.Equipment[slot] = newItem
	player.EquipmentRevision++
	player.RecalculateStats()

	return player, true, "Upgrade successful"
}

func forgeInventoryStackCount(item Item) int {
	if item.Stack > 0 {
		return item.Stack
	}
	return 1
}

func ensureForgeBasis(item *Item) {
	if item.ForgeBasis.Valid() {
		return
	}
	item.ForgeBasis = (&forging.Basis{Level: max(1, item.Level), Potency: max(0, item.Potency), Stats: item.Stats, Value: item.Value}).Clone()
}

func isForgeHeartItem(item Item) bool {
	return strings.EqualFold(item.Name, "Eidolon Heart") || strings.EqualFold(item.Name, "Heart")
}

func isForgeShardItem(item Item) bool {
	return strings.EqualFold(item.Name, "Eidolon Shard") || strings.EqualFold(item.Name, "Shard")
}

func (w *World) PerformForgePotency(playerID, slot string, expected ...*ForgeQuote) (*Entity, bool, string) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false, "Player not found"
	}
	player.Mu.Lock()
	defer player.Mu.Unlock()

	// Get item from slot
	item, ok := player.Equipment[slot]
	if !ok {
		return nil, false, "No item in slot"
	}

	if !forgeQuoteMatches(item, expected) {
		return nil, false, "Equipment changed. Review the Forge preview and try again."
	}
	if item.Potency < 0 || item.Potency >= 20 {
		return nil, false, "Max potency reached"
	}

	cost := forging.PotencyCost(item.Potency)

	// Check Hearts
	heartCount := 0
	for _, invItem := range player.Inventory {
		if isForgeHeartItem(invItem) {
			heartCount += forgeInventoryStackCount(invItem)
		}
	}

	if heartCount < cost {
		return nil, false, fmt.Sprintf("Not enough Hearts. Need %d", cost)
	}

	// Deduct Hearts
	remainingCost := cost
	for i := len(player.Inventory) - 1; i >= 0; i-- {
		if isForgeHeartItem(player.Inventory[i]) {
			take := remainingCost
			stackCount := forgeInventoryStackCount(player.Inventory[i])
			if stackCount <= take {
				take = stackCount
				player.Inventory = append(player.Inventory[:i], player.Inventory[i+1:]...)
			} else {
				player.Inventory[i].Stack -= take
			}
			remainingCost -= take
			if remainingCost <= 0 {
				break
			}
		}
	}

	// Upgrade Potency
	newItem := cloneItem(item)
	ensureForgeBasis(&newItem)
	newItem.Potency++
	newItem.Stats, newItem.Value = newItem.ForgeBasis.Scale(newItem.Level, newItem.Potency)

	player.Equipment[slot] = newItem
	player.EquipmentRevision++
	player.RecalculateStats()

	return player, true, "Potency upgrade successful"
}

func (w *World) PerformForgeSocket(playerID, slot string, expected ...*ForgeQuote) (*Entity, bool, string) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false, "Player not found"
	}
	player.Mu.Lock()
	defer player.Mu.Unlock()

	// Get item from slot
	item, ok := player.Equipment[slot]
	if !ok {
		return nil, false, "No item in slot"
	}

	if item.Sockets >= 4 {
		return nil, false, "Max sockets reached"
	}
	if !forgeQuoteMatches(item, expected) {
		return nil, false, "Equipment changed. Review the Forge preview and try again."
	}

	// Calculate Cost
	// 25 Hearts + 250 Shards * (2 ^ current_sockets)
	shardCost := 250 * int(math.Pow(2, float64(item.Sockets)))
	heartCost := 25

	// Check Resources
	shardCount := 0
	heartCount := 0
	for _, invItem := range player.Inventory {
		if isForgeShardItem(invItem) {
			shardCount += forgeInventoryStackCount(invItem)
		}
		if isForgeHeartItem(invItem) {
			heartCount += forgeInventoryStackCount(invItem)
		}
	}

	if shardCount < shardCost {
		return nil, false, fmt.Sprintf("Not enough Shards. Need %d", shardCost)
	}
	if heartCount < heartCost {
		return nil, false, fmt.Sprintf("Not enough Hearts. Need %d", heartCost)
	}

	// Deduct Shards
	remainingShards := shardCost
	for i := len(player.Inventory) - 1; i >= 0; i-- {
		if isForgeShardItem(player.Inventory[i]) {
			take := remainingShards
			stackCount := forgeInventoryStackCount(player.Inventory[i])
			if stackCount <= take {
				take = stackCount
				player.Inventory = append(player.Inventory[:i], player.Inventory[i+1:]...)
			} else {
				player.Inventory[i].Stack -= take
			}
			remainingShards -= take
			if remainingShards <= 0 {
				break
			}
		}
	}

	// Deduct Hearts
	remainingHearts := heartCost
	for i := len(player.Inventory) - 1; i >= 0; i-- {
		if isForgeHeartItem(player.Inventory[i]) {
			take := remainingHearts
			stackCount := forgeInventoryStackCount(player.Inventory[i])
			if stackCount <= take {
				take = stackCount
				player.Inventory = append(player.Inventory[:i], player.Inventory[i+1:]...)
			} else {
				player.Inventory[i].Stack -= take
			}
			remainingHearts -= take
			if remainingHearts <= 0 {
				break
			}
		}
	}

	// Add Socket
	newItem := cloneItem(item)
	newItem.Sockets++
	player.Equipment[slot] = newItem
	player.EquipmentRevision++

	return player, true, "Socket added successfully"
}

// PerformForgeInsertGem inserts a gem from inventory into an equipment socket
func (w *World) PerformForgeInsertGem(playerID, equipSlot string, gemInvIndex, socketIndex int, expected ...*ForgeQuote) (*Entity, bool, string) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false, "Player not found"
	}
	player.Mu.Lock()
	defer player.Mu.Unlock()

	// Get equipment item
	equipItem, ok := player.Equipment[equipSlot]
	if !ok {
		return nil, false, "No item in equipment slot"
	}

	// Check if equipment has sockets
	if !forgeQuoteMatches(equipItem, expected) || !forgeGemQuoteMatches(player.Inventory, []int{gemInvIndex}, expected) {
		return nil, false, "Equipment or gems changed. Review the Forge preview and try again."
	}
	if equipItem.Sockets <= 0 {
		return nil, false, "Equipment has no sockets"
	}

	// Check socket index is valid
	usedSockets := len(equipItem.Gems)
	if socketIndex < 0 || socketIndex >= equipItem.Sockets {
		return nil, false, "Invalid socket index"
	}

	// Check if socket is already filled
	if socketIndex < usedSockets {
		return nil, false, "Socket already has a gem"
	}

	// Check we're inserting into the next available socket
	if socketIndex != usedSockets {
		return nil, false, "Must fill sockets in order"
	}

	// Get gem from inventory
	if gemInvIndex < 0 || gemInvIndex >= len(player.Inventory) {
		return nil, false, "Invalid inventory slot"
	}

	gemItem := player.Inventory[gemInvIndex]
	if gemItem.Type != ItemGem {
		return nil, false, "Item is not a gem"
	}

	// Create socketed gem from gem item
	socketedGem := SocketedGem{
		Type:    gemItem.GemType,
		Quality: gemItem.GemQuality,
		Stats:   gemItem.Stats,
	}

	// Add gem to equipment
	newEquipItem := cloneItem(equipItem)
	if newEquipItem.Gems == nil {
		newEquipItem.Gems = make([]SocketedGem, 0)
	}
	newEquipItem.Gems = append(newEquipItem.Gems, socketedGem)
	player.Equipment[equipSlot] = newEquipItem
	player.EquipmentRevision++

	// Consume one unit, not the entire selected stack.
	consumeForgeGemUnits(player.Inventory, gemInvIndex, 1)
	player.RecalculateStats()

	return player, true, "Gem inserted successfully"
}

// PerformForgeCombineGems combines 3 gems of same type and quality into 1 gem of next quality
func (w *World) PerformForgeCombineGems(playerID string, gemIndices [3]int, expected ...*ForgeQuote) (*Entity, bool, string) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false, "Player not found"
	}
	player.Mu.Lock()
	defer player.Mu.Unlock()

	// A stack may supply multiple units of the three-gem recipe.
	if !forgeGemQuoteMatches(player.Inventory, gemIndices[:], expected) {
		return nil, false, "Gems changed. Review the Forge preview and try again."
	}
	indexCounts := make(map[int]int)
	for _, idx := range gemIndices {
		if idx < 0 || idx >= len(player.Inventory) {
			return nil, false, "Invalid inventory slot"
		}
		indexCounts[idx]++
		if indexCounts[idx] > forgeInventoryStackCount(player.Inventory[idx]) {
			return nil, false, "Not enough gems in the selected stack"
		}
	}

	// Get the three gems and validate they're all gems of same type and quality
	gems := make([]Item, 3)
	for i, idx := range gemIndices {
		gems[i] = player.Inventory[idx]
		if gems[i].Type != ItemGem {
			return nil, false, "Item is not a gem"
		}
	}

	// Check all gems are same type and quality
	gemType := gems[0].GemType
	gemQuality := gems[0].GemQuality
	for i := 1; i < 3; i++ {
		if gems[i].GemType != gemType {
			return nil, false, "All gems must be the same type"
		}
		if gems[i].GemQuality != gemQuality {
			return nil, false, "All gems must be the same quality"
		}
	}

	// Check if we can upgrade (not already max quality)
	nextQuality := GetNextGemQuality(gemQuality)
	if nextQuality == "" {
		return nil, false, "Gems are already maximum quality"
	}

	// Create the upgraded gem
	upgradedGem := GenerateGem(gemType, nextQuality)

	// Plan consumption and output together: a full bag must not destroy inputs.
	planned := &Entity{Inventory: cloneItems(player.Inventory)}
	for len(planned.Inventory) < MaxInventorySize {
		planned.Inventory = append(planned.Inventory, Item{})
	}
	for index, count := range indexCounts {
		consumeForgeGemUnits(planned.Inventory, index, count)
	}
	if planned.AddItemToInventory(*upgradedGem) != 0 {
		return nil, false, "Make room in your bag for the combined gem"
	}
	player.Inventory = planned.Inventory

	return player, true, "Gems combined successfully"
}

func consumeForgeGemUnits(inventory []Item, index, count int) {
	remaining := forgeInventoryStackCount(inventory[index]) - count
	if remaining <= 0 {
		inventory[index] = Item{}
	} else {
		inventory[index].Stack = remaining
	}
}

// PerformForgeRemoveGem removes a gem from an equipment socket (gem is destroyed)
func (w *World) PerformForgeRemoveGem(playerID, equipSlot string, socketIndex int, expected ...*ForgeQuote) (*Entity, bool, string) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false, "Player not found"
	}
	player.Mu.Lock()
	defer player.Mu.Unlock()

	// Get equipment item
	equipItem, ok := player.Equipment[equipSlot]
	if !ok {
		return nil, false, "No item in equipment slot"
	}

	// Check if equipment has gems
	if !forgeQuoteMatches(equipItem, expected) {
		return nil, false, "Equipment changed. Review the Forge preview and try again."
	}
	if len(equipItem.Gems) == 0 {
		return nil, false, "Equipment has no socketed gems"
	}

	// Check socket index is valid
	if socketIndex < 0 || socketIndex >= len(equipItem.Gems) {
		return nil, false, "Invalid socket index"
	}

	// Remove gem from equipment (gem is destroyed)
	newEquipItem := cloneItem(equipItem)
	newEquipItem.Gems = append(newEquipItem.Gems[:socketIndex], newEquipItem.Gems[socketIndex+1:]...)
	player.Equipment[equipSlot] = newEquipItem
	player.EquipmentRevision++
	player.RecalculateStats()

	return player, true, "Gem removed (destroyed)"
}

func (w *World) PerformBuyGamble(playerID, slot string) (*Entity, bool) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false
	}

	// Price is 35 Gold per level. Actual resale returns depend on generated
	// item values; the economy receipt audit measures them separately.
	cost := int(math.Ceil(35 * float64(player.Level)))

	if player.Gold < cost {
		return nil, false
	}

	player.Gold -= cost
	item := GenerateLootForSlot(slot, player.Level)
	if item != nil {
		remaining := player.AddItemToInventory(*item)
		if remaining == item.Stack {
			// Inventory full, nothing added
			player.Gold += cost
			return nil, false
		}
		// If remaining > 0 but < item.Stack, we partially added.
		// We keep the gold as the transaction partially succeeded.
		w.Economy.RecordSink("gambling", cost)
		return player, true
	} else {
		player.Gold += cost
		return nil, false
	}
}

// vendorStackPrice preserves legacy one-Gold/single-item defaults while refusing
// an unrepresentable total before Gold, custody or telemetry is changed.
func vendorStackPrice(item Item) (int, bool) {
	value, stack := item.Value, item.Stack
	if value <= 0 {
		value = 1
	}
	if stack <= 0 {
		stack = 1
	}
	if value > math.MaxInt/stack {
		return 0, false
	}
	return value * stack, true
}

// Ambiguous legacy IDs must not be sold or recovered by arbitrarily choosing
// one copy. Keep all existing data so an operator can investigate it safely.
// The caller owns the character lock.
func vendorHasSingleItem(player *Entity, itemID string) bool {
	count := 0
	for _, items := range [][]Item{player.Inventory, player.Buyback} {
		for _, item := range items {
			if item.ID == itemID {
				count++
			}
		}
	}
	return count == 1
}

func (w *World) PerformSell(playerID, itemID string) (*Entity, bool) {
	if itemID == "" {
		return nil, false
	}
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false
	}
	player.Mu.Lock()
	defer player.Mu.Unlock()
	if player.Gold < 0 || !vendorHasSingleItem(player, itemID) {
		return nil, false
	}

	invIndex := -1
	var itemToSell *Item
	for i := range player.Inventory {
		if player.Inventory[i].ID == itemID {
			itemToSell = &player.Inventory[i]
			invIndex = i
			break
		}
	}

	if itemToSell == nil {
		return nil, false
	}
	if IsChronicleQuestItem(*itemToSell) {
		return nil, false
	}

	saleValue, validPrice := vendorStackPrice(*itemToSell)
	if !validPrice || player.Gold > math.MaxInt-saleValue {
		return nil, false
	}
	player.Gold += saleValue
	w.Economy.RecordSource("vendor_sales", saleValue)

	// Add to buyback (Legendary only)
	log.Printf("Selling item: %s, Rarity: %s", itemToSell.Name, itemToSell.Rarity)

	if strings.EqualFold(string(itemToSell.Rarity), string(RarityLegendary)) {
		player.Buyback = append(player.Buyback, *itemToSell)
		if len(player.Buyback) > 20 {
			player.Buyback = player.Buyback[1:]
		}
	}

	// Clear slot
	player.Inventory[invIndex] = Item{}

	compacted := make([]Item, len(player.Inventory))
	next := 0
	for _, item := range player.Inventory {
		if item.ID == "" {
			continue
		}
		compacted[next] = item
		next++
	}
	player.Inventory = compacted

	return player, true
}

func (w *World) PerformBuyback(playerID, itemID string) (*Entity, bool) {
	if itemID == "" {
		return nil, false
	}
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false
	}
	player.Mu.Lock()
	defer player.Mu.Unlock()
	if player.Gold < 0 || !vendorHasSingleItem(player, itemID) {
		return nil, false
	}

	buybackIndex := -1
	var itemToBuy *Item
	for i := range player.Buyback {
		if player.Buyback[i].ID == itemID {
			itemToBuy = &player.Buyback[i]
			buybackIndex = i
			break
		}
	}

	if itemToBuy == nil {
		return nil, false
	}

	totalCost, validPrice := vendorStackPrice(*itemToBuy)
	if !validPrice || player.Gold < totalCost {
		return nil, false
	}

	freeSlot := -1
	for i := 0; i < len(player.Inventory) && i < MaxInventorySize; i++ {
		if player.Inventory[i].ID == "" {
			freeSlot = i
			break
		}
	}
	if freeSlot < 0 && len(player.Inventory) >= MaxInventorySize {
		return nil, false
	}

	player.Gold -= totalCost
	w.Economy.RecordSink("buyback", totalCost)
	if freeSlot >= 0 {
		player.Inventory[freeSlot] = *itemToBuy
	} else {
		player.Inventory = append(player.Inventory, *itemToBuy)
	}

	// Remove from buyback
	player.Buyback = append(player.Buyback[:buybackIndex], player.Buyback[buybackIndex+1:]...)

	return player, true
}

func (w *World) PerformStashDeposit(playerID, itemID string) (*Entity, bool) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false
	}

	// Find item in Inventory
	invIndex := -1
	var itemToDeposit *Item
	for i := range player.Inventory {
		if player.Inventory[i].ID == itemID {
			itemToDeposit = &player.Inventory[i]
			invIndex = i
			break
		}
	}

	if itemToDeposit == nil || IsChronicleQuestItem(*itemToDeposit) {
		return nil, false
	}

	// Move to Stash
	remaining := player.AddItemToStash(*itemToDeposit)

	if remaining == 0 {
		// Fully deposited
		player.Inventory[invIndex] = Item{}
		return player, true
	} else if remaining < itemToDeposit.Stack {
		// Partially deposited
		player.Inventory[invIndex].Stack = remaining
		return player, true
	}

	return nil, false
}

func (w *World) PerformStashWithdraw(playerID, itemID string) (*Entity, bool) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false
	}

	// Find item in Stash
	stashIndex := -1
	var itemToWithdraw *Item
	for i := range player.Stash {
		if player.Stash[i].ID == itemID {
			itemToWithdraw = &player.Stash[i]
			stashIndex = i
			break
		}
	}

	if itemToWithdraw == nil {
		return nil, false
	}

	// Move to Inventory
	remaining := player.AddItemToInventory(*itemToWithdraw)

	if remaining == 0 {
		// Fully withdrawn
		lastIdx := len(player.Stash) - 1
		player.Stash[stashIndex] = player.Stash[lastIdx]
		player.Stash = player.Stash[:lastIdx]
		return player, true
	} else if remaining < itemToWithdraw.Stack {
		// Partially withdrawn
		player.Stash[stashIndex].Stack = remaining
		return player, true
	}

	return nil, false
}
