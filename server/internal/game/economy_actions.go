package game

import (
	"fmt"
	"log"
	"math"
	"strings"
)

func (w *World) PerformForgeUpgrade(playerID, slot string, amount int) (*Entity, bool, string) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false, "Player not found"
	}

	// Get item from slot
	item, ok := player.Equipment[slot]
	if !ok {
		return nil, false, "No item in slot"
	}

	if amount <= 0 {
		amount = 1
	}

	// Calculate Cost and Target Level
	cost := 0
	targetLevel := 0

	// Calculate per-level cost
	perLevelCost := 0
	if item.Level < 90 {
		tier := item.Level / 10
		baseTierCost := int(math.Pow(2, float64(tier)))
		// User requested 1/10th of the cost for the range.
		// Previous range cost was baseTierCost.
		// So 10 levels should cost baseTierCost / 10.
		// So 1 level should cost baseTierCost / 100.
		perLevelCost = baseTierCost / 100
		if perLevelCost < 1 {
			perLevelCost = 1
		}
	} else {
		perLevelCost = 2 // 200 / 100
	}

	targetLevel = item.Level + amount
	if targetLevel > 100 {
		targetLevel = 100
	}

	levelsToAdd := targetLevel - item.Level
	if levelsToAdd <= 0 {
		return nil, false, "Max level reached"
	}

	cost = perLevelCost * levelsToAdd

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
	newItem := item
	oldLevel := newItem.Level
	newItem.Level = targetLevel

	// Scale Stats
	// Using Base Stat scaling formula: (1 + 0.15 * NewLevel) / (1 + 0.15 * OldLevel)
	ratio := (1.0 + float64(newItem.Level)*0.15) / (1.0 + float64(oldLevel)*0.15)

	for k, v := range newItem.Stats {
		newItem.Stats[k] = int(float64(v) * ratio)
	}

	// Update Value
	newItem.Value = int(float64(newItem.Value) * ratio)

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

func isForgeHeartItem(item Item) bool {
	return strings.EqualFold(item.Name, "Eidolon Heart") || strings.EqualFold(item.Name, "Heart")
}

func isForgeShardItem(item Item) bool {
	return strings.EqualFold(item.Name, "Eidolon Shard") || strings.EqualFold(item.Name, "Shard")
}

func (w *World) PerformForgePotency(playerID, slot string) (*Entity, bool, string) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false, "Player not found"
	}

	// Get item from slot
	item, ok := player.Equipment[slot]
	if !ok {
		return nil, false, "No item in slot"
	}

	if item.Potency >= 20 {
		return nil, false, "Max potency reached"
	}

	// Calculate Cost: 2 ^ Potency
	cost := int(math.Pow(2, float64(item.Potency)))

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
	newItem := item
	oldPotency := newItem.Potency
	newItem.Potency++

	// Scale Stats: +10% per potency level
	// NewStats = OldStats * (1 + 0.1 * NewPotency) / (1 + 0.1 * OldPotency)
	oldMult := 1.0 + (0.1 * float64(oldPotency))
	newMult := 1.0 + (0.1 * float64(newItem.Potency))
	ratio := newMult / oldMult

	for k, v := range newItem.Stats {
		newItem.Stats[k] = int(float64(v) * ratio)
	}

	// Update Value
	newItem.Value = int(float64(newItem.Value) * ratio)

	player.Equipment[slot] = newItem
	player.EquipmentRevision++
	player.RecalculateStats()

	return player, true, "Potency upgrade successful"
}

func (w *World) PerformForgeSocket(playerID, slot string) (*Entity, bool, string) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false, "Player not found"
	}

	// Get item from slot
	item, ok := player.Equipment[slot]
	if !ok {
		return nil, false, "No item in slot"
	}

	if item.Sockets >= 4 {
		return nil, false, "Max sockets reached"
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
	newItem := item
	newItem.Sockets++
	player.Equipment[slot] = newItem
	player.EquipmentRevision++

	return player, true, "Socket added successfully"
}

// PerformForgeInsertGem inserts a gem from inventory into an equipment socket
func (w *World) PerformForgeInsertGem(playerID, equipSlot string, gemInvIndex, socketIndex int) (*Entity, bool, string) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false, "Player not found"
	}

	// Get equipment item
	equipItem, ok := player.Equipment[equipSlot]
	if !ok {
		return nil, false, "No item in equipment slot"
	}

	// Check if equipment has sockets
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
	newEquipItem := equipItem
	if newEquipItem.Gems == nil {
		newEquipItem.Gems = make([]SocketedGem, 0)
	}
	newEquipItem.Gems = append(newEquipItem.Gems, socketedGem)
	player.Equipment[equipSlot] = newEquipItem
	player.EquipmentRevision++

	// Remove gem from inventory
	player.Inventory = append(player.Inventory[:gemInvIndex], player.Inventory[gemInvIndex+1:]...)

	return player, true, "Gem inserted successfully"
}

// PerformForgeCombineGems combines 3 gems of same type and quality into 1 gem of next quality
func (w *World) PerformForgeCombineGems(playerID string, gemIndices [3]int) (*Entity, bool, string) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false, "Player not found"
	}

	// Validate indices are unique and in range
	indexMap := make(map[int]bool)
	for _, idx := range gemIndices {
		if idx < 0 || idx >= len(player.Inventory) {
			return nil, false, "Invalid inventory slot"
		}
		if indexMap[idx] {
			return nil, false, "Duplicate gem slot selected"
		}
		indexMap[idx] = true
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

	// Remove the 3 gems from inventory (remove from highest index first to preserve indices)
	sortedIndices := make([]int, 3)
	copy(sortedIndices, gemIndices[:])
	// Sort descending
	for i := 0; i < 2; i++ {
		for j := i + 1; j < 3; j++ {
			if sortedIndices[i] < sortedIndices[j] {
				sortedIndices[i], sortedIndices[j] = sortedIndices[j], sortedIndices[i]
			}
		}
	}
	for _, idx := range sortedIndices {
		player.Inventory = append(player.Inventory[:idx], player.Inventory[idx+1:]...)
	}

	// Add upgraded gem to inventory
	player.Inventory = append(player.Inventory, *upgradedGem)

	return player, true, "Gems combined successfully"
}

// PerformForgeRemoveGem removes a gem from an equipment socket (gem is destroyed)
func (w *World) PerformForgeRemoveGem(playerID, equipSlot string, socketIndex int) (*Entity, bool, string) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false, "Player not found"
	}

	// Get equipment item
	equipItem, ok := player.Equipment[equipSlot]
	if !ok {
		return nil, false, "No item in equipment slot"
	}

	// Check if equipment has gems
	if len(equipItem.Gems) == 0 {
		return nil, false, "Equipment has no socketed gems"
	}

	// Check socket index is valid
	if socketIndex < 0 || socketIndex >= len(equipItem.Gems) {
		return nil, false, "Invalid socket index"
	}

	// Remove gem from equipment (gem is destroyed)
	newEquipItem := equipItem
	newEquipItem.Gems = append(newEquipItem.Gems[:socketIndex], newEquipItem.Gems[socketIndex+1:]...)
	player.Equipment[equipSlot] = newEquipItem
	player.EquipmentRevision++

	return player, true, "Gem removed (destroyed)"
}

func (w *World) PerformBuyGamble(playerID, slot string) (*Entity, bool) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false
	}

	// Cost calculated to ensure ~0.5% house edge against EV (34.5 * Level)
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

func (w *World) PerformSell(playerID, itemID string) (*Entity, bool) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
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

	value := itemToSell.Value
	if value <= 0 {
		value = 1
	}

	stackSize := itemToSell.Stack
	if stackSize <= 0 {
		stackSize = 1
	}

	saleValue := value * stackSize
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
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
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

	cost := itemToBuy.Value
	if cost <= 0 {
		cost = 1
	}
	stackSize := itemToBuy.Stack
	if stackSize <= 0 {
		stackSize = 1
	}
	totalCost := cost * stackSize

	if player.Gold < totalCost {
		return nil, false
	}

	player.Gold -= totalCost
	w.Economy.RecordSink("buyback", totalCost)
	player.Inventory = append(player.Inventory, *itemToBuy)

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

	if itemToDeposit == nil {
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
