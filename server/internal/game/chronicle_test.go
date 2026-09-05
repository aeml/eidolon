package game

import (
	"strings"
	"testing"
	"time"
)

func questByID(t *testing.T, player *Entity, id string) *Quest {
	t.Helper()
	for i := range player.Quests {
		if player.Quests[i].ID == id {
			return &player.Quests[i]
		}
	}
	t.Fatalf("quest %s not found", id)
	return nil
}

func completedChronicleThrough(player *Entity, chapter int) {
	catalog := chronicleQuestCatalog()
	for i := 0; i < chapter && i < len(catalog); i++ {
		quest := catalog[i]
		quest.Accepted = true
		quest.Completed = true
		quest.Count = quest.MaxCount
		player.Quests = append(player.Quests, quest)
	}
	ensureChronicleLocked(player)
	for i := range player.Quests {
		if !player.Quests[i].Completed {
			player.Quests[i].Accepted = true
		}
	}
}

func TestChronicleCatalogIsDeepOrderedAndOfferedByWizard(t *testing.T) {
	catalog := chronicleQuestCatalog()
	if len(catalog) != 15 {
		t.Fatalf("expected 15 Chronicle chapters, got %d", len(catalog))
	}
	for i, quest := range catalog {
		if quest.Category != QuestCategoryChronicle || quest.Chapter != i+1 {
			t.Fatalf("chapter %d is not ordered Chronicle content: %+v", i+1, quest)
		}
		if quest.Title == "" || len(quest.Description) < 100 || len(quest.Lore) < 100 || quest.ObjectiveText == "" {
			t.Fatalf("chapter %d is missing authored narrative depth: %+v", i+1, quest)
		}
	}
	if catalog[2].Target != "HollowSentinel" || catalog[4].Target != "Thalorath" ||
		catalog[6].Target != "LordInfernax" || catalog[8].Target != "Zephyrion" ||
		catalog[13].Target != "EidolonDevourer" || catalog[14].Target != "UmbraPrime" {
		t.Fatal("Chronicle does not connect all four crystal bosses to the Dark Realm finale")
	}
	for index, target := range []string{"EarthCrystal", "WaterCrystal", "FireCrystal", "AirCrystal"} {
		quest := catalog[9+index]
		if quest.Type != "REPAIR" || quest.Target != target || !strings.Contains(quest.ObjectiveText, "3 repair waves") {
			t.Fatalf("chapter %d is not a defended raid repair: %+v", quest.Chapter, quest)
		}
	}

	player := &Entity{ID: "hero", Type: TypePlayer}
	if !ensureChronicleLocked(player) {
		t.Fatal("new character should receive a Chronicle")
	}
	if len(player.Quests) != 1 || player.Quests[0].Accepted || player.Quests[0].ID != catalog[0].ID {
		t.Fatalf("expected only chapter one to be offered: %+v", player.Quests)
	}
}

func TestChronicleRequiresManualTurnInForKillAndCollectionChapters(t *testing.T) {
	w := NewWorld(nil)
	player := &Entity{
		ID: "hero", Type: TypePlayer, Level: 1, MaxHealth: 100, Health: 100,
		Inventory: make([]Item, MaxInventorySize),
	}
	ensureChronicleLocked(player)
	w.AddEntity(player)
	player.X, player.Z = 20, 215
	if _, ok := w.PerformAcceptQuest(player.ID, player.Quests[0].ID); !ok {
		t.Fatal("could not accept first chapter")
	}
	events := []ChronicleAdvanceEvent{}
	w.OnEvent = func(kind string, data interface{}) {
		if kind == "chronicle_advance" {
			events = append(events, data.(ChronicleAdvanceEvent))
		}
	}

	for i := 0; i < 3; i++ {
		w.UpdateQuestProgress(player, "Skeleton")
	}
	if questByID(t, player, "chronicle_01_bell_below").Completed || len(events) != 0 {
		t.Fatal("objective progress completed a chapter without turn-in")
	}
	if _, ok := w.PerformCompleteQuest(player.ID, "chronicle_01_bell_below"); !ok {
		t.Fatal("manual completion failed")
	}
	collection := questByID(t, player, "chronicle_02_seeds_first_grove")
	if collection.Accepted || collection.Completed {
		t.Fatalf("second chapter was accepted without asking: %+v", collection)
	}
	if _, ok := w.PerformAcceptQuest(player.ID, collection.ID); !ok {
		t.Fatal("could not accept collection")
	}

	for i := 0; i < 4; i++ {
		item := ChronicleDropForKill(player, "Imp", 0.1)
		if item == nil || item.Name != "Verdant Memory Seed" || !IsChronicleQuestItem(*item) {
			t.Fatalf("expected personal Earth artifact drop, got %+v", item)
		}
		if player.AddItemToInventory(*item) != 0 {
			t.Fatal("test inventory unexpectedly full")
		}
		w.UpdateCollectionQuestProgress(player, item.Name, 1)
	}
	if questByID(t, player, "chronicle_02_seeds_first_grove").Completed {
		t.Fatal("collection auto-completed")
	}
	if player.Inventory[0].Name != "Verdant Memory Seed" {
		t.Fatal("items consumed before turn-in")
	}
	if _, ok := w.PerformCompleteQuest(player.ID, "chronicle_02_seeds_first_grove"); !ok {
		t.Fatal("collection turn-in failed")
	}
	if next := questByID(t, player, ChronicleEarthDungeonID); next.Accepted {
		t.Fatalf("Earth dungeon chapter was auto-accepted: %+v", next)
	}
	for _, item := range player.Inventory {
		if item.Name == "Verdant Memory Seed" {
			t.Fatal("repaired crystal did not consume its collected artifacts")
		}
	}
	if len(events) != 2 || events[1].NextID != ChronicleEarthDungeonID {
		t.Fatalf("expected two story advance events, got %+v", events)
	}
}

func TestChronicleCanAdvanceAcrossAllFifteenChaptersInOrder(t *testing.T) {
	w := NewWorld(nil)
	player := &Entity{
		ID: "whole-story-hero", Type: TypePlayer, Level: 1, MaxHealth: 100, Health: 100,
		Inventory: make([]Item, MaxInventorySize),
	}
	ensureChronicleLocked(player)
	w.AddEntity(player)
	player.X, player.Z = 20, 215
	advances := []ChronicleAdvanceEvent{}
	w.OnEvent = func(kind string, data interface{}) {
		if kind == "chronicle_advance" {
			advances = append(advances, data.(ChronicleAdvanceEvent))
		}
	}

	for _, definition := range chronicleQuestCatalog() {
		if _, ok := w.PerformAcceptQuest(player.ID, definition.ID); !ok {
			t.Fatalf("chapter %d accept failed", definition.Chapter)
		}
		active := questByID(t, player, definition.ID)
		if !active.Accepted || active.Completed {
			t.Fatalf("chapter %d was not the active story step: %+v", definition.Chapter, active)
		}
		switch definition.Type {
		case "KILL":
			for count := 0; count < definition.MaxCount; count++ {
				w.UpdateQuestProgress(player, definition.Target)
			}
		case "COLLECT":
			player.Inventory[0] = Item{ID: "chronicle-item-chain", Name: definition.Target, Stack: definition.MaxCount, MaxStack: definition.MaxCount}
			w.UpdateCollectionQuestProgress(player, definition.Target, definition.MaxCount)
		case "REPAIR":
			w.UpdateChronicleEventProgress(player, "REPAIR", definition.Target)
		default:
			t.Fatalf("chapter %d has unsupported objective type %q", definition.Chapter, definition.Type)
		}
		if questByID(t, player, definition.ID).Completed {
			t.Fatal("objective auto-completed")
		}
		if _, ok := w.PerformCompleteQuest(player.ID, definition.ID); !ok {
			t.Fatalf("chapter %d turn-in failed", definition.Chapter)
		}
		if !questByID(t, player, definition.ID).Completed {
			t.Fatalf("chapter %d did not complete", definition.Chapter)
		}
	}

	if len(advances) != 15 || !advances[len(advances)-1].Finale {
		t.Fatalf("expected fifteen ordered advances ending in the finale, got %+v", advances)
	}
	for index, event := range advances {
		if event.CompletedID != chronicleQuestCatalog()[index].ID {
			t.Fatalf("story advanced out of order at position %d: %+v", index, event)
		}
	}
}

func TestDailyResetPreservesChronicleProgress(t *testing.T) {
	w := NewWorld(nil)
	player := &Entity{ID: "hero", Type: TypePlayer, LastDailyQuest: time.Now().Add(-48 * time.Hour)}
	completedChronicleThrough(player, 4)
	ensureChronicleLocked(player)
	active := questByID(t, player, ChronicleWaterDungeonID)
	active.Count = 0
	w.AddEntity(player)

	w.GenerateDailyQuests(player.ID)
	if !questByID(t, player, ChronicleEarthDungeonID).Completed || !questByID(t, player, ChronicleWaterDungeonID).Accepted {
		t.Fatal("daily reset erased or rewound Chronicle state")
	}
	dailyCount := 0
	for _, quest := range player.Quests {
		if isDailyQuest(quest) {
			dailyCount++
		}
	}
	if dailyCount != len(dailyQuestCatalog()) {
		t.Fatalf("expected %d fresh dailies, got %d", len(dailyQuestCatalog()), dailyCount)
	}
}

func TestChronicleWorldLootIsOwnerOnlyAndAdvancesOnPickup(t *testing.T) {
	w := NewWorld(nil)
	owner := &Entity{ID: "owner", Type: TypePlayer, Health: 100, X: 0, Z: 0, Inventory: make([]Item, MaxInventorySize)}
	completedChronicleThrough(owner, 1)
	ensureChronicleLocked(owner)
	stranger := &Entity{ID: "stranger", Type: TypePlayer, Health: 100, X: 0, Z: 0, Inventory: make([]Item, MaxInventorySize)}
	w.AddEntity(owner)
	w.AddEntity(stranger)
	item := ChronicleDropForKill(owner, "Skeleton", 0.1)
	loot := &Entity{ID: "story-loot", Type: TypeLoot, X: 0, Z: 0, LootOwnerID: owner.ID, LootItem: item}
	w.AddEntity(loot)

	if _, ok, reason := w.PerformPickup(stranger.ID, loot.ID); ok || reason != "not_your_loot" {
		t.Fatalf("stranger could take soulbound story loot: ok=%v reason=%q", ok, reason)
	}
	if _, ok, reason := w.PerformPickup(owner.ID, loot.ID); !ok || reason != "" {
		t.Fatalf("owner could not collect story loot: ok=%v reason=%q", ok, reason)
	}
	if questByID(t, owner, "chronicle_02_seeds_first_grove").Count != 1 {
		t.Fatal("pickup did not advance collection objective")
	}
}

func TestChronicleArtifactsAreSoulboundAcrossEconomySystems(t *testing.T) {
	w := NewWorld(nil)
	item := Item{ID: "chronicle-item-one", Name: "Verdant Memory Seed", Type: ItemRelic, Stack: 1, MaxStack: 4}
	player := &Entity{ID: "seller", Type: TypePlayer, Gold: 100, Inventory: make([]Item, MaxInventorySize)}
	player.Inventory[0] = item
	w.AddEntity(player)
	if _, ok := w.PerformSell(player.ID, item.ID); ok {
		t.Fatal("vendor accepted a soulbound Chronicle artifact")
	}
	if _, err := w.Trading.CreateAuction(player, item, 1, 2, 1); err == nil || !strings.Contains(err.Error(), "soulbound") {
		t.Fatalf("auction accepted Chronicle artifact: %v", err)
	}
}

func TestChroniclePartyGateRequiresEveryMember(t *testing.T) {
	w := NewWorld(nil)
	leader := &Entity{ID: "leader", Name: "Leader", Type: TypePlayer}
	member := &Entity{ID: "member", Name: "Member", Type: TypePlayer}
	completedChronicleThrough(leader, 3)
	completedChronicleThrough(member, 2)
	w.AddEntity(leader)
	w.AddEntity(member)
	party := w.CreateParty(leader.ID)
	if err := w.JoinParty(party.ID, member.ID); err != nil {
		t.Fatal(err)
	}
	if err := w.RequirePartyChronicleQuest(party.ID, ChronicleEarthDungeonID); err == nil || !strings.Contains(err.Error(), "Member") {
		t.Fatalf("expected member-specific story gate, got %v", err)
	}
	quest := chronicleQuestCatalog()[2]
	quest.Accepted, quest.Completed, quest.Count = true, true, quest.MaxCount
	*questByID(t, member, quest.ID) = quest
	if err := w.RequirePartyChronicleQuest(party.ID, ChronicleEarthDungeonID); err != nil {
		t.Fatalf("fully qualified party was rejected: %v", err)
	}
}

func TestElementalRaidsUnlockFromDungeonsAndContainCrystalVigils(t *testing.T) {
	cases := []struct {
		raidType, dungeonQuest, repairQuest, boss string
	}{
		{"earth_crystal_raid", ChronicleEarthDungeonID, ChronicleEarthRestoredID, "GravenColossus"},
		{"water_crystal_raid", ChronicleWaterDungeonID, ChronicleWaterRestoredID, "TideboundTyrant"},
		{"fire_crystal_raid", ChronicleFireDungeonID, ChronicleFireRestoredID, "AshenImperator"},
		{"air_crystal_raid", ChronicleAirDungeonID, ChronicleAirRestoredID, "TempestSovereign"},
	}
	for _, testCase := range cases {
		definition, ok := ElementalRaidDefinitionForType(testCase.raidType)
		if !ok || definition.RequiredDungeonQuest != testCase.dungeonQuest || definition.RestoredQuest != testCase.repairQuest || definition.Boss != testCase.boss {
			t.Fatalf("invalid elemental raid definition for %s: %+v", testCase.raidType, definition)
		}
	}

	w := NewWorld(nil)
	instanceID := w.CreateDungeon("raid-party", "earth_crystal_raid", DifficultyNormal, 30)
	if got := w.GetInstanceType(instanceID); got != "earth_crystal_raid" {
		t.Fatalf("expected Earth raid instance, got %q", got)
	}
	layout, ok := w.GetInstanceLayout(instanceID)
	if !ok || len(layout.Rooms) < 4 {
		t.Fatalf("elemental raid did not build a full assault route: %+v", layout)
	}
	last := layout.Rooms[len(layout.Rooms)-1]
	if last.Type != "boss" || last.Hook != "crystal_vigil" {
		t.Fatalf("raid does not culminate at a crystal Vigil: %+v", last)
	}
	foundBoss := false
	for _, entity := range w.Entities {
		if entity.InstanceID == instanceID && entity.SubType == "GravenColossus" {
			foundBoss = true
			break
		}
	}
	if !foundBoss {
		t.Fatal("Rootheart Sanctum is missing its raid guardian")
	}
}

func TestCrystalRepairCompletionAdvancesRaidVigilAndNextRaid(t *testing.T) {
	w := NewWorld(nil)
	player := &Entity{ID: "hero", Type: TypePlayer, InstanceID: "earth-raid", Inventory: make([]Item, MaxInventorySize)}
	completedChronicleThrough(player, 9)
	ensureChronicleLocked(player)
	if active := questByID(t, player, ChronicleEarthRestoredID); active.Type != "REPAIR" || !active.Accepted {
		t.Fatalf("expected Rootheart Vigil after four dungeon arcs: %+v", active)
	}
	w.AddEntity(player)
	state := &CrystalRepairState{
		InstanceID: "earth-raid", RaidType: "earth_crystal_raid", Element: "Earth", Crystal: "Rootheart Crystal",
		RepairTarget: "EarthCrystal", Participants: []string{player.ID},
	}
	w.completeCrystalRepair(state)
	if q := questByID(t, player, ChronicleEarthRestoredID); q.Completed || q.Count != q.MaxCount {
		t.Fatal("repair should be ready, awaiting report to Ilyra")
	}
	player.InstanceID, player.X, player.Z = "", 20, 215
	if _, ok := w.PerformCompleteQuest(player.ID, ChronicleEarthRestoredID); !ok {
		t.Fatal("repair turn-in failed")
	}
	if questByID(t, player, ChronicleWaterRestoredID).Accepted {
		t.Fatal("next Vigil should be offered, not auto-accepted")
	}
}

func TestCrystalRepairSpawnsPersonalNPCAndThreeEscalatingWaveRules(t *testing.T) {
	w := NewWorld(nil)
	events := []CrystalRepairEvent{}
	w.OnEvent = func(kind string, data interface{}) {
		if kind == "crystal_repair" {
			events = append(events, data.(CrystalRepairEvent))
		}
	}
	if !w.StartCrystalRepair("missing-instance", "earth_crystal_raid", []string{"hero"}, 10, 20) {
		t.Fatal("valid raid did not start its repair Vigil")
	}
	artificer := w.GetEntity("crystal-artificer-missing-instance")
	if artificer == nil || artificer.SubType != "CrystalKeeper" || artificer.Name != "Maelin, Resonance Artificer" || artificer.State != "CHANNELING" {
		t.Fatalf("repair NPC was not spawned and channeling: %+v", artificer)
	}
	if len(events) != 1 || events[0].Stage != "ritual_start" || events[0].TotalWaves != 3 {
		t.Fatalf("repair start was not presented as a three-wave defense: %+v", events)
	}

	state := &CrystalRepairState{InstanceID: "wave-instance", RaidType: "earth_crystal_raid", CenterX: 0, CenterZ: 0}
	first := w.spawnCrystalRepairWave(state, 1)
	third := w.spawnCrystalRepairWave(state, 3)
	if len(first) != 6 || len(third) != 10 {
		t.Fatalf("repair waves do not escalate from 6 to 10 attackers: first=%d third=%d", len(first), len(third))
	}
}

func TestClearedElementalRaidRestartsInterruptedCrystalRepairOnEntry(t *testing.T) {
	w := NewWorld(nil)
	player := &Entity{ID: "returning-hero", Name: "Returning Hero", Type: TypePlayer, Level: 30, Inventory: make([]Item, MaxInventorySize)}
	completedChronicleThrough(player, 9)
	ensureChronicleLocked(player)
	w.AddEntity(player)
	party := w.CreateParty(player.ID)
	if party == nil {
		t.Fatal("failed to create repair recovery party")
	}
	instanceID := w.CreateDungeon(party.ID, "earth_crystal_raid", DifficultyNormal, 30)
	instance, ok := w.getDungeonInstance(instanceID)
	if !ok {
		t.Fatal("elemental raid instance was not created")
	}
	instance.Mu.Lock()
	lastIndex := len(instance.RoomState.Rooms) - 1
	instance.RoomState.Rooms[lastIndex].Cleared = true
	instance.Mu.Unlock()

	if err := w.EnterInstance(player.ID, instanceID); err != nil {
		t.Fatal(err)
	}
	w.RepairMu.RLock()
	repair := w.CrystalRepairs[instanceID]
	w.RepairMu.RUnlock()
	if repair == nil || repair.RaidType != "earth_crystal_raid" {
		t.Fatalf("cleared restored raid did not restart its repair Vigil: %+v", repair)
	}
	if artificer := w.GetEntity(repair.NPCID); artificer == nil || artificer.SubType != "CrystalKeeper" {
		t.Fatal("restarted repair Vigil did not restore Maelin")
	}
	w.PerformRecall(player.ID)
	if err := w.ResetDungeon(party.ID); err != nil {
		t.Fatal(err)
	}
}

func TestDarkKingFourPhasesApplyEidolonAid(t *testing.T) {
	w := NewWorld(nil)
	boss := &Entity{ID: "dark-king", Type: TypeEnemy, SubType: "UmbraPrime", State: "IDLE", InstanceID: "raid", Health: 1000, MaxHealth: 1000}
	player := &Entity{ID: "hero", Type: TypePlayer, State: "IDLE", InstanceID: "raid", Health: 40, MaxHealth: 100, Mana: 0, MaxMana: 100}
	phases := []RaidPhaseEvent{}
	w.OnEvent = func(kind string, data interface{}) {
		if kind == "raid_phase" {
			phases = append(phases, data.(RaidPhaseEvent))
		}
	}

	w.updateDarkKingPhase(boss, []*Entity{player})
	boss.Health = 700
	w.updateDarkKingPhase(boss, []*Entity{player})
	if player.Health != 65 {
		t.Fatalf("Neris should heal 25%% max health, got %d", player.Health)
	}
	boss.Health = 500
	w.updateDarkKingPhase(boss, []*Entity{player})
	if boss.Health != 420 {
		t.Fatalf("Pyralis should sear 8%% max health, got %d", boss.Health)
	}
	boss.Health = 250
	w.updateDarkKingPhase(boss, []*Entity{player})
	if player.Mana != player.MaxMana {
		t.Fatal("Aeral did not restore raid mana")
	}
	if len(phases) != 4 || phases[0].Eidolon != "Orun" || phases[1].Eidolon != "Neris" ||
		phases[2].Eidolon != "Pyralis" || phases[3].Eidolon != "Aeral" {
		t.Fatalf("unexpected four-phase story: %+v", phases)
	}

	attacker := &Entity{Type: TypePlayer}
	boss.Health = 500
	damage, _ := CalculateFinalDamage(attacker, boss, 100, "physical")
	if damage != 125 {
		t.Fatalf("Pyralis phase should amplify damage to 125, got %d", damage)
	}
	boss.Health = 250
	damage, _ = CalculateFinalDamage(attacker, boss, 100, "physical")
	if damage != 135 {
		t.Fatalf("Aeral phase should amplify damage to 135, got %d", damage)
	}
	player.Health = 100
	boss.Health = 1000
	damage, _ = CalculateFinalDamage(boss, player, 100, "physical")
	if damage != 80 {
		t.Fatalf("Orun phase should reduce Dark King damage to 80, got %d", damage)
	}
}
