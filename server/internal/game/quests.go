package game

import (
	"fmt"
	"log"
	"strings"
	"time"
)

const (
	QuestCategoryDaily     = "daily"
	QuestCategoryChronicle = "chronicle"

	ChronicleEarthDungeonID  = "chronicle_03_roots_remember"
	ChronicleWaterDungeonID  = "chronicle_05_drowned_name"
	ChronicleFireDungeonID   = "chronicle_07_crown_of_embers"
	ChronicleAirDungeonID    = "chronicle_09_sky_answers"
	ChronicleEarthRestoredID = "chronicle_10_rootheart_raid"
	ChronicleWaterRestoredID = "chronicle_11_tidestar_raid"
	ChronicleFireRestoredID  = "chronicle_12_ember_crown_raid"
	ChronicleAirRestoredID   = "chronicle_13_skyglass_raid"
	ChronicleGateOpenedID    = "chronicle_14_resonance_gate"
	ChronicleDarkKingID      = "chronicle_15_dark_king"
)

// ChronicleAdvanceEvent is emitted after a story chapter completes. The next
// chapter becomes available from Archmage Ilyra, but must be accepted explicitly.
type ChronicleAdvanceEvent struct {
	PlayerID       string `json:"playerId"`
	CompletedID    string `json:"completedId"`
	CompletedTitle string `json:"completedTitle"`
	NextID         string `json:"nextId,omitempty"`
	NextTitle      string `json:"nextTitle,omitempty"`
	NextLore       string `json:"nextLore,omitempty"`
	Finale         bool   `json:"finale"`
}

func chronicleQuestCatalog() []Quest {
	return []Quest{
		{
			ID: "chronicle_01_bell_below", Type: "KILL", Target: "Skeleton", MaxCount: 3, RewardXP: 500,
			Title: "The Bell That Rang Below", Category: QuestCategoryChronicle, Chapter: 1,
			ObjectiveText: "Defeat 3 risen dead beyond Aethelgard's walls and recover their dissonant echoes.",
			Description:   "I am Ilyra, keeper of the Fourfold Chronicle. Last night I heard a bell beneath Lanternhold that has no living ringer. The four crystals are faltering, and my wards cannot reach their buried sanctums. I need your help to save Eidolon. Face the risen dead beyond our walls and bring me the echoes bound inside them; together we can trace the wound.",
			Lore:          "Eidolon was not named for a kingdom. It was named for the four great spirits who dreamed matter into covenant: Orun of Root and Stone, Neris of Tide and Memory, Pyralis of Flame and Will, and Aeral of Sky and Freedom. Their crystals do not create the elements—they keep the elements willing to shelter mortal lands.",
		},
		{
			ID: "chronicle_02_seeds_first_grove", Type: "COLLECT", Target: "Verdant Memory Seed", MaxCount: 4, RewardXP: 8000,
			Title: "Seeds of the First Grove", Category: QuestCategoryChronicle, Chapter: 2,
			ObjectiveText: "Recover 4 Verdant Memory Seeds from Earth-realm creatures, then let the Rootheart draw them into itself.",
			Description:   "The echoes name the first wound: the Rootheart Crystal beneath the Verdant Bastion is forgetting every forest it ever sustained. Creatures touched by its failing pulse carry fragments of those memories. Gather enough to remind the crystal what it was.",
			Lore:          "A Verdant Memory Seed is not truly a seed. It is a moment made solid: rain on the first leaf, roots splitting ancient rock, the patience of mountains. When the Rootheart weakens, such memories fall loose and lodge in living things.",
		},
		{
			ID: ChronicleEarthDungeonID, Type: "KILL", Target: "HollowSentinel", MaxCount: 1, RewardXP: 250000,
			Title: "When the Roots Remember", Category: QuestCategoryChronicle, Chapter: 3,
			ObjectiveText: "Clear the Verdant Bastion Catacombs and defeat the Hollow Sentinel to uncover the road to the Rootheart sanctum.",
			Description:   "Carry the restored memories through the entire Bastion. The Hollow Sentinel guards an old root-road rather than the crystal itself; break the shadow command inside it and the sealed path to Orun's deeper raid sanctum will open.",
			Lore:          "Orun hid the Rootheart beyond a living labyrinth so no passing army could touch it. The Dark King corrupted the outer Sentinel, but even he could not enter the inner sanctum without first forcing a mortal hand to open the way.",
		},
		{
			ID: "chronicle_04_pearls_without_tides", Type: "COLLECT", Target: "Moon-Tide Pearl", MaxCount: 4, RewardXP: 500000,
			Title: "Pearls Without Tides", Category: QuestCategoryChronicle, Chapter: 4,
			ObjectiveText: "Recover 4 Moon-Tide Pearls from Water-realm creatures to restore the Tidestar's rhythm.",
			Description:   "With the Rootheart raid-road uncovered for the coming Vigils, a second voice reaches you through wells and rain. The Tidestar has lost the pull that lets water remember its way home. Hunt the warped creatures of the Water realm; pieces of the stolen tide gleam inside them.",
			Lore:          "Neris keeps every promise spoken beside water. Sailors once cast Moon-Tide Pearls into unknown seas so even a shipwrecked vow could find its shore. Now the pearls are motionless, severed from moon and memory alike.",
		},
		{
			ID: ChronicleWaterDungeonID, Type: "KILL", Target: "Thalorath", MaxCount: 1, RewardXP: 2000000,
			Title: "The Drowned Name", Category: QuestCategoryChronicle, Chapter: 5,
			ObjectiveText: "Clear the Abyssal Well and defeat Thalorath to reveal the submerged way into the Tidestar Confluence raid.",
			Description:   "Thalorath swallowed the route-name leading to Neris's hidden Confluence and chained the dungeon to an endless undertow. Clear the full Abyssal Well and reclaim that name so the water itself can carry your raid to the crystal.",
			Lore:          "Water survives by yielding without surrender. The Dark King could not command Neris, so he taught Thalorath to consume names. A nameless thing cannot remember where it belongs—and a nameless ocean will drown every border.",
		},
		{
			ID: "chronicle_06_ash_refuses_cool", Type: "COLLECT", Target: "Cinderheart Ore", MaxCount: 4, RewardXP: 5000000,
			Title: "Ash That Refuses to Cool", Category: QuestCategoryChronicle, Chapter: 6,
			ObjectiveText: "Recover 4 pieces of Cinderheart Ore from Fire-realm creatures and reforge the Ember Crown's broken circuit.",
			Description:   "The Ember Crown still burns, but its flame gives no warmth and leaves no fertile ash. Fire has been reduced to hunger. Find Cinderheart Ore in the realm's corrupted creatures—the metal remembers that flame must illuminate, transform, and finally release.",
			Lore:          "Pyralis gave mortals the first forge on one condition: every weapon must outlive the anger that shaped it. Cinderheart Ore carries that compact. It glows brightest when a bearer chooses purpose over appetite.",
		},
		{
			ID: ChronicleFireDungeonID, Type: "KILL", Target: "LordInfernax", MaxCount: 1, RewardXP: 8000000,
			Title: "The Crown of Embers", Category: QuestCategoryChronicle, Chapter: 7,
			ObjectiveText: "Clear the Molten Core and defeat Lord Infernax to seize the furnace-key to the Ember Crown Crucible raid.",
			Description:   "Lord Infernax feeds the dungeon an empire's worth of imagined wars. Clear his Molten Core and take the furnace-key he guards. Only that living flame can breach the separate Crucible fortress built around the Ember Crown.",
			Lore:          "The Dark King promised Infernax an eternal victory. He neglected to say that eternal victory requires an eternal war. Beneath the tyrant's boasting is a prisoner who has forgotten the difference between conquest and flame.",
		},
		{
			ID: "chronicle_08_feathers_thunder", Type: "COLLECT", Target: "Stormglass Pinion", MaxCount: 4, RewardXP: 5000000,
			Title: "Feathers of Captured Thunder", Category: QuestCategoryChronicle, Chapter: 8,
			ObjectiveText: "Recover 4 Stormglass Pinions from Air-realm creatures and rebuild the Skyglass lattice.",
			Description:   "Three regions answer again, revealing the silence above them. The Skyglass Crystal has been caged inside a single repeating storm. Its shattered pinions drift through the creatures trapped in that loop. Gather them and give the wind a future again.",
			Lore:          "Aeral refuses temples with doors. The wind Eidolon taught that freedom is not the absence of bonds, but the power to choose them. Stormglass forms where lightning makes that choice in an instant and leaves its decision behind.",
		},
		{
			ID: ChronicleAirDungeonID, Type: "KILL", Target: "Zephyrion", MaxCount: 1, RewardXP: 8000000,
			Title: "The Sky Answers", Category: QuestCategoryChronicle, Chapter: 9,
			ObjectiveText: "Clear the Tempest Spire and defeat Zephyrion to expose the wind-road into the Skyglass Eyrie raid.",
			Description:   "Zephyrion has mistaken endless motion for freedom. Clear the full Spire and shatter his repeating storm. In the instant the loop breaks, Aeral can hold open a wind-road to the separate Eyrie where the crystal is imprisoned.",
			Lore:          "The four crystals were separated so no mortal ruler could command the whole resonance. They were never meant to be isolated. Their oldest song says: stone gives water a bed, water tempers fire, fire raises wind, and wind carries seed back to stone.",
		},
		{
			ID: ChronicleEarthRestoredID, Type: "REPAIR", Target: "EarthCrystal", MaxCount: 1, RewardXP: 750000,
			Title: "The Rootheart Vigil", Category: QuestCategoryChronicle, Chapter: 10,
			ObjectiveText: "Complete the Rootheart Sanctum raid, then defend Artificer Maelin through all 3 repair waves.",
			Description:   "All four raid-roads are now known. Return first to the Rootheart Sanctum, where Malachar's Graven Colossus commands an occupying host. Clear the full raid, then hold the ritual circle through three counterattacks while Maelin sets the Memory Seeds into the crystal.",
			Lore:          "A crystal cannot be repaired by force. A mortal artificer aligns the physical facets, an Eidolon supplies elemental memory, and defenders preserve the few unbroken seconds in which both may agree. This rite is called a Vigil, never a conquest.",
		},
		{
			ID: ChronicleWaterRestoredID, Type: "REPAIR", Target: "WaterCrystal", MaxCount: 1, RewardXP: 3500000,
			Title: "The Tidestar Vigil", Category: QuestCategoryChronicle, Chapter: 11,
			ObjectiveText: "Complete the Tidestar Confluence raid, then defend Artificer Maelin through all 3 repair waves.",
			Description:   "Follow the reclaimed route-name into Neris's Confluence, break the Tidebound Tyrant's siege, and secure the crystal chamber. Maelin must tune each Moon-Tide Pearl while three waves rise from the dark water to silence the repair.",
			Lore:          "The Tidestar is a compass for more than ships. It teaches every river, tear, and vein how to move without losing itself. During its Vigil, Neris remembers the defenders as part of that returning current.",
		},
		{
			ID: ChronicleFireRestoredID, Type: "REPAIR", Target: "FireCrystal", MaxCount: 1, RewardXP: 10000000,
			Title: "The Ember Crown Vigil", Category: QuestCategoryChronicle, Chapter: 12,
			ObjectiveText: "Complete the Ember Crown Crucible raid, then defend Artificer Maelin through all 3 repair waves.",
			Description:   "Use Infernax's key to assault the Crucible and defeat the Ashen Imperator. Then protect Maelin as the Cinderheart Ore is forged into the crystal's broken circuit. Each repair wave is a final temptation to turn purposeful flame back into hunger.",
			Lore:          "Pyralis does not bless destruction; Pyralis blesses the courage to change. When the Ember Crown accepts a repair, every defender sees one thing they must release and one thing worth carrying through the fire.",
		},
		{
			ID: ChronicleAirRestoredID, Type: "REPAIR", Target: "AirCrystal", MaxCount: 1, RewardXP: 10000000,
			Title: "The Skyglass Vigil", Category: QuestCategoryChronicle, Chapter: 13,
			ObjectiveText: "Complete the Skyglass Eyrie raid, then defend Artificer Maelin through all 3 repair waves.",
			Description:   "Ride Aeral's wind-road into the Eyrie and bring down the Tempest Sovereign. In the open crystal chamber, hold three converging storm-waves away from Maelin while each pinion is returned to the Skyglass lattice.",
			Lore:          "The Skyglass does not predict a single future. It preserves the fact that another direction is always possible. Its repaired song will provide the final overtone needed to aim all four crystals beyond the known world.",
		},
		{
			ID: ChronicleGateOpenedID, Type: "KILL", Target: "EidolonDevourer", MaxCount: 1, RewardXP: 12000000,
			Title: "The Fifth Note", Category: QuestCategoryChronicle, Chapter: 14,
			ObjectiveText: "Enter the Umbral Nexus and defeat the Eidolon Devourer so the four restored crystals can open the Dark Realm gate.",
			Description:   "Only after all four raid Vigils are complete can Rootheart, Tidestar, Ember Crown, and Skyglass resonate. Their chord exposes a fifth note hidden between them: the Umbral Nexus. Defeat the Devourer there so the resonance can hold a portal into the Dark Realm.",
			Lore:          "Shadow is not a fifth element. It is the distance between a thing and the truth it refuses to face. The Dark King built his realm from that distance, then fed it with every fear the four guardians buried in silence.",
		},
		{
			ID: ChronicleDarkKingID, Type: "KILL", Target: "UmbraPrime", MaxCount: 1, RewardXP: 25000000,
			Title: "The King Beyond Shadow", Category: QuestCategoryChronicle, Chapter: 15,
			ObjectiveText: "Lead a raid through the opened Dark Realm portal and defeat Malachar, the Dark King.",
			Description:   "The resonance holds. Beyond the portal waits Malachar, architect of the crystal wounds. He means to make every element dependent on his command, then offer Eidolon a choice between obedience and extinction. Enter his court and let the four spirits answer him in battle.",
			Lore:          "Malachar was once the mortal keeper who carried messages between the four sanctums. He came to despise a world whose powers required balance instead of obedience. If he falls, it will not be because one champion overpowered him, but because Earth, Water, Fire, Air, and mortal will chose one another freely.",
		},
	}
}

func dailyQuestCatalog() []Quest {
	quests := []Quest{
		{ID: "daily_skeleton", Type: "KILL", Target: "Skeleton", MaxCount: 100, RewardXP: 50000},
		{ID: "daily_imp", Type: "KILL", Target: "Imp", MaxCount: 100, RewardXP: 150000},
		{ID: "daily_demonorc", Type: "KILL", Target: "DemonOrc", MaxCount: 100, RewardXP: 300000},
		{ID: "daily_construct", Type: "KILL", Target: "Construct", MaxCount: 100, RewardXP: 500000},
		{ID: "daily_infernotitan", Type: "KILL", Target: "InfernoTitan", MaxCount: 100, RewardXP: 800000},
		{ID: "daily_mountaintroll", Type: "KILL", Target: "MountainTroll", MaxCount: 100, RewardXP: 1200000},
		{ID: "daily_aquagolem", Type: "KILL", Target: "AquaGolem", MaxCount: 100, RewardXP: 1600000},
		{ID: "daily_siren", Type: "KILL", Target: "Siren", MaxCount: 100, RewardXP: 2200000},
		{ID: "daily_frostguardian", Type: "KILL", Target: "FrostGuardian", MaxCount: 100, RewardXP: 3000000},
		{ID: "daily_sandstormdjinn", Type: "KILL", Target: "SandstormDjinn", MaxCount: 100, RewardXP: 4000000},
		{ID: "daily_magmagolem", Type: "KILL", Target: "MagmaGolem", MaxCount: 100, RewardXP: 5000000},
		{ID: "daily_scorchedwraith", Type: "KILL", Target: "ScorchedWraith", MaxCount: 100, RewardXP: 6500000},
		{ID: "daily_infernalbehemoth", Type: "KILL", Target: "InfernalBehemoth", MaxCount: 100, RewardXP: 8000000},
		{ID: "daily_phoenixsentinel", Type: "KILL", Target: "PhoenixSentinel", MaxCount: 100, RewardXP: 10000000},
		{ID: "daily_stormharpy", Type: "KILL", Target: "StormHarpy", MaxCount: 100, RewardXP: 4000000},
		{ID: "daily_cloudelemental", Type: "KILL", Target: "CloudElemental", MaxCount: 100, RewardXP: 5000000},
		{ID: "daily_thunderroc", Type: "KILL", Target: "ThunderRoc", MaxCount: 100, RewardXP: 6500000},
		{ID: "daily_tempestgiant", Type: "KILL", Target: "TempestGiant", MaxCount: 100, RewardXP: 8000000},
		{ID: "daily_cycloneavatar", Type: "KILL", Target: "CycloneAvatar", MaxCount: 100, RewardXP: 10000000},
		{ID: "daily_dungeon_bosses", Type: "KILL", Target: "DungeonBoss", MaxCount: 4, RewardXP: 5000000},
		{ID: "daily_verdant_bastion_bosses", Type: "KILL", Target: "VerdantBastionBoss", MaxCount: 4, RewardXP: 3000000},
		{ID: "daily_abyssal_well_bosses", Type: "KILL", Target: "AbyssalWellBoss", MaxCount: 5, RewardXP: 6000000},
		{ID: "daily_molten_core_bosses", Type: "KILL", Target: "MoltenCoreBoss", MaxCount: 5, RewardXP: 9000000},
		{ID: "daily_tempest_spire_bosses", Type: "KILL", Target: "TempestSpireBoss", MaxCount: 5, RewardXP: 9000000},
		{ID: "daily_dungeon_bosses_heroic", Type: "KILL", Target: "DungeonBossHeroic", MaxCount: 4, RewardXP: 10000000},
		{ID: "daily_dungeon_bosses_mythic", Type: "KILL", Target: "DungeonBossMythic", MaxCount: 4, RewardXP: 15000000},
	}
	for i := range quests {
		quests[i].Category = QuestCategoryDaily
		quests[i].Title = fmt.Sprintf("Daily Hunt: %s", splitQuestTarget(quests[i].Target))
		quests[i].ObjectiveText = fmt.Sprintf("Defeat %d %s.", quests[i].MaxCount, splitQuestTarget(quests[i].Target))
		quests[i].Description = "A repeatable contract from Aethelgard's quest giver. Daily hunts reset at midnight Eastern Time."
	}
	return quests
}

func splitQuestTarget(target string) string {
	var out []rune
	for i, char := range target {
		if i > 0 && char >= 'A' && char <= 'Z' {
			out = append(out, ' ')
		}
		out = append(out, char)
	}
	return string(out)
}

func isDailyQuest(q Quest) bool {
	return q.Category == QuestCategoryDaily || strings.HasPrefix(q.ID, "daily_")
}

func copyQuestDefinition(progress Quest, definition Quest) Quest {
	definition.Count = progress.Count
	definition.Completed = progress.Completed
	definition.Accepted = progress.Accepted
	return definition
}

// ensureChronicleLocked repairs metadata and offers only the next unfinished
// chapter. Existing accepted/completed progress survives migration and resets.
func ensureChronicleLocked(player *Entity) bool {
	if player == nil {
		return false
	}
	catalog := chronicleQuestCatalog()
	byID := make(map[string]Quest, len(catalog))
	for _, definition := range catalog {
		byID[definition.ID] = definition
	}
	changed := false
	indices := make(map[string]int, len(catalog))
	for i := range player.Quests {
		definition, ok := byID[player.Quests[i].ID]
		if !ok {
			continue
		}
		existing := player.Quests[i]
		repaired := copyQuestDefinition(existing, definition)
		if existing != repaired {
			player.Quests[i] = repaired
			changed = true
		}
		indices[definition.ID] = i
	}
	nextIndex := 0
	for nextIndex < len(catalog) {
		idx, exists := indices[catalog[nextIndex].ID]
		if !exists || !player.Quests[idx].Completed {
			break
		}
		nextIndex++
	}
	if nextIndex < len(catalog) {
		definition := catalog[nextIndex]
		if _, exists := indices[definition.ID]; !exists {
			player.Quests = append(player.Quests, definition)
			changed = true
		}
	}
	return changed
}

func (w *World) GenerateDailyQuests(playerID string) *Entity {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	player, ok := w.Entities[playerID]
	if !ok {
		return nil
	}
	ensureChronicleLocked(player)

	loc, err := time.LoadLocation("America/New_York")
	if err != nil {
		log.Printf("Error loading timezone America/New_York: %v. Defaulting to UTC.", err)
		loc = time.UTC
	}
	now := time.Now().In(loc)
	y, m, d := now.Date()
	ly, lm, ld := player.LastDailyQuest.In(loc).Date()
	catalog := dailyQuestCatalog()
	if y == ly && m == lm && d == ld {
		catalogByID := make(map[string]Quest, len(catalog))
		for _, quest := range catalog {
			catalogByID[quest.ID] = quest
		}
		existingIDs := make(map[string]bool, len(catalog))
		for i := range player.Quests {
			q := player.Quests[i]
			definition, exists := catalogByID[q.ID]
			if !exists {
				continue
			}
			player.Quests[i] = copyQuestDefinition(q, definition)
			existingIDs[q.ID] = true
		}
		for _, quest := range catalog {
			if !existingIDs[quest.ID] {
				player.Quests = append(player.Quests, quest)
			}
		}
		return player
	}

	log.Printf("Generating daily quests for %s (Last: %v, Now: %v)", player.Name, player.LastDailyQuest, now)
	persistent := make([]Quest, 0, len(player.Quests)+len(catalog))
	for _, quest := range player.Quests {
		if !isDailyQuest(quest) {
			persistent = append(persistent, quest)
		}
	}
	player.Quests = append(persistent, catalog...)
	player.LastDailyQuest = now
	return player
}

func (w *World) PerformAcceptQuest(playerID, questID string) (*Entity, bool) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false
	}
	for i := range player.Quests {
		q := &player.Quests[i]
		if q.ID == questID {
			if q.Accepted || q.Completed || !w.canDiscussQuestLocked(player, *q) {
				return nil, false
			}
			q.Accepted = true
			return player, true
		}
	}
	return nil, false
}

func (w *World) PerformCompleteQuest(playerID, questID string) (*Entity, bool) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false
	}
	for i := range player.Quests {
		q := &player.Quests[i]
		if q.ID == questID {
			if !q.Accepted || q.Completed || q.Count < q.MaxCount || !w.canDiscussQuestLocked(player, *q) {
				return nil, false
			}
			if q.Type == "COLLECT" {
				available := 0
				for _, item := range player.Inventory {
					if item.ID != "" && item.Name == q.Target {
						available += item.Stack
					}
				}
				if available < q.MaxCount {
					return nil, false
				}
				consumeInventoryItemLocked(player, q.Target, q.MaxCount)
			}
			if q.Category == QuestCategoryChronicle {
				event := w.advanceChronicleLocked(player, i)
				if w.OnEvent != nil {
					w.OnEvent("chronicle_advance", event)
				}
			} else {
				q.Completed = true
				w.awardExperienceLocked(player, q.RewardXP)
			}
			return player, true
		}
	}
	return nil, false
}

// Quest actions are town conversations, not remotely callable reward claims.
// Recheck chapter order even if a saved client submits a future chapter ID.
func (w *World) canDiscussQuestLocked(player *Entity, quest Quest) bool {
	npcID := "quest-npc-1"
	if quest.Category == QuestCategoryChronicle {
		npcID = "story-wizard-1"
		for _, definition := range chronicleQuestCatalog() {
			if definition.ID == quest.ID {
				break
			}
			if !HasCompletedChronicleQuest(player, definition.ID) {
				return false
			}
		}
	} else if !isDailyQuest(quest) {
		return false
	}
	npc := w.Entities[npcID]
	if npc == nil || player.InstanceID != npc.InstanceID {
		return false
	}
	dx, dz := player.X-npc.X, player.Z-npc.Z
	return dx*dx+dz*dz <= 100
}

func questSnapshot(player *Entity) []Quest {
	quests := make([]Quest, len(player.Quests))
	copy(quests, player.Quests)
	return quests
}

func (w *World) advanceChronicleLocked(player *Entity, questIndex int) ChronicleAdvanceEvent {
	quest := &player.Quests[questIndex]
	quest.Completed = true
	w.awardExperienceLocked(player, quest.RewardXP)
	event := ChronicleAdvanceEvent{PlayerID: player.ID, CompletedID: quest.ID, CompletedTitle: quest.Title}
	ensureChronicleLocked(player)
	for _, next := range player.Quests {
		if next.Category == QuestCategoryChronicle && !next.Completed {
			event.NextID = next.ID
			event.NextTitle = next.Title
			event.NextLore = next.Lore
			break
		}
	}
	event.Finale = event.NextID == ""
	return event
}

func (w *World) publishQuestProgress(player *Entity, updated bool) {
	if !updated {
		return
	}
	if w.OnQuestUpdate != nil {
		w.OnQuestUpdate(player.ID, questSnapshot(player))
	}
}

func (w *World) UpdateQuestProgress(player *Entity, targetType string) bool {
	updated := false
	for i := 0; i < len(player.Quests); i++ {
		q := &player.Quests[i]
		if !q.Accepted || q.Completed || q.Type != "KILL" || q.Target != targetType {
			continue
		}
		if q.Count < q.MaxCount {
			q.Count++
			updated = true
		}
	}
	w.publishQuestProgress(player, updated)
	return updated
}

func consumeInventoryItemLocked(player *Entity, name string, amount int) {
	for i := range player.Inventory {
		if amount <= 0 {
			return
		}
		item := &player.Inventory[i]
		if item.ID == "" || item.Name != name {
			continue
		}
		take := min(amount, item.Stack)
		item.Stack -= take
		amount -= take
		if item.Stack <= 0 {
			player.Inventory[i] = Item{}
		}
	}
}

func (w *World) UpdateCollectionQuestProgress(player *Entity, itemName string, amount int) bool {
	if player == nil || amount <= 0 {
		return false
	}
	updated := false
	for i := 0; i < len(player.Quests); i++ {
		q := &player.Quests[i]
		if !q.Accepted || q.Completed || q.Type != "COLLECT" || q.Target != itemName {
			continue
		}
		remaining := max(0, q.MaxCount-q.Count)
		credited := min(amount, remaining)
		q.Count += credited
		updated = updated || credited > 0
	}
	w.publishQuestProgress(player, updated)
	return updated
}

// UpdateChronicleEventProgress advances non-loot story objectives such as the
// defended crystal-repair Vigils. Only the active Chronicle chapter can match.
func (w *World) UpdateChronicleEventProgress(player *Entity, eventType, target string) bool {
	if player == nil {
		return false
	}
	updated := false
	for i := 0; i < len(player.Quests); i++ {
		q := &player.Quests[i]
		if !q.Accepted || q.Completed || q.Category != QuestCategoryChronicle || q.Type != eventType || q.Target != target {
			continue
		}
		if q.Count < q.MaxCount {
			q.Count = q.MaxCount
			updated = true
		}
	}
	w.publishQuestProgress(player, updated)
	return updated
}

var chronicleDropSources = map[string]map[string]bool{
	"Verdant Memory Seed": {"Skeleton": true, "Imp": true, "DemonOrc": true, "Construct": true, "InfernoTitan": true},
	"Moon-Tide Pearl":     {"MountainTroll": true, "AquaGolem": true, "Siren": true, "FrostGuardian": true},
	"Cinderheart Ore":     {"SandstormDjinn": true, "MagmaGolem": true, "ScorchedWraith": true, "InfernalBehemoth": true, "PhoenixSentinel": true},
	"Stormglass Pinion":   {"StormHarpy": true, "CloudElemental": true, "ThunderRoc": true, "TempestGiant": true, "CycloneAvatar": true},
}

// ChronicleDropForKill returns a personal world drop for the player's current
// elemental chapter. The explicit roll keeps the authoritative rule testable.
func ChronicleDropForKill(player *Entity, defeatedSubType string, roll float64) *Item {
	if player == nil {
		return nil
	}
	for _, quest := range player.Quests {
		if quest.Category != QuestCategoryChronicle || quest.Type != "COLLECT" || !quest.Accepted || quest.Completed || quest.Count >= quest.MaxCount {
			continue
		}
		if !chronicleDropSources[quest.Target][defeatedSubType] {
			return nil
		}
		guaranteed := defeatedSubType == "InfernoTitan" || defeatedSubType == "FrostGuardian" ||
			defeatedSubType == "PhoenixSentinel" || defeatedSubType == "CycloneAvatar"
		if !guaranteed && roll >= 0.65 {
			return nil
		}
		return &Item{
			ID: fmt.Sprintf("chronicle-item-%d", time.Now().UnixNano()), Name: quest.Target,
			Type: ItemRelic, Rarity: RarityEidolic, Slot: "relic", Level: max(1, player.Level),
			Value: 0, Stack: 1, MaxStack: 4,
			Description: "A soulbound fragment called forth by the four-crystal Chronicle. It cannot be traded or sold.",
		}
	}
	return nil
}

func IsChronicleQuestItem(item Item) bool {
	return strings.HasPrefix(item.ID, "chronicle-item-")
}

func HasCompletedChronicleQuest(player *Entity, questID string) bool {
	if player == nil {
		return false
	}
	for _, quest := range player.Quests {
		if quest.ID == questID {
			return quest.Completed
		}
	}
	return false
}

func ChronicleAccessStatus(player *Entity) (crystalsRestored, darkRealmOpen, darkKingDefeated bool) {
	crystalsRestored = HasCompletedChronicleQuest(player, ChronicleEarthRestoredID) &&
		HasCompletedChronicleQuest(player, ChronicleWaterRestoredID) &&
		HasCompletedChronicleQuest(player, ChronicleFireRestoredID) &&
		HasCompletedChronicleQuest(player, ChronicleAirRestoredID)
	darkRealmOpen = HasCompletedChronicleQuest(player, ChronicleGateOpenedID)
	darkKingDefeated = HasCompletedChronicleQuest(player, ChronicleDarkKingID)
	return
}

// RequirePartyChronicleQuest keeps the Dark Realm story gate authoritative for
// every participant; an unlocked leader cannot carry an unqualified group in.
func (w *World) RequirePartyChronicleQuest(partyID, questID string) error {
	w.Mu.RLock()
	party := w.Parties[partyID]
	if party == nil {
		w.Mu.RUnlock()
		return fmt.Errorf("party not found")
	}
	party.Mu.RLock()
	members := append([]string(nil), party.Members...)
	party.Mu.RUnlock()
	players := make([]*Entity, 0, len(members))
	for _, memberID := range members {
		if player := w.Entities[memberID]; player != nil {
			players = append(players, player)
		} else {
			w.Mu.RUnlock()
			return fmt.Errorf("every party member must be online")
		}
	}
	w.Mu.RUnlock()
	for _, player := range players {
		player.Mu.RLock()
		unlocked := HasCompletedChronicleQuest(player, questID)
		name := player.Name
		player.Mu.RUnlock()
		if !unlocked {
			return fmt.Errorf("%s has not completed the required Chronicle chapter", name)
		}
	}
	return nil
}
