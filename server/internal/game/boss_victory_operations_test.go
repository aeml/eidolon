package game

import (
	"math"
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/database"
)

func bossVictoryEffectFixture(player *Entity) database.BossVictoryOperation {
	op := database.BossVictoryOperation{Version: 1, InstanceID: "dungeon_original_boss", BossType: "RootboundWarden",
		DungeonType: "verdant_bastion_catacombs", RoomIndex: 2, Difficulty: "mythic", RunLevel: 30, CreatedAt: time.Now().UTC().Truncate(time.Millisecond),
		Participants: []database.BossVictoryRecipient{{Username: player.Name, PlayerID: player.ID, Gold: 73, XP: 234,
			Items:  []string{`{"id":"original-blade","name":"Original","type":"WEAPON","stack":1,"maxStack":1,"potency":7,"stats":{"damage":73}}`},
			Quests: []database.BossVictoryKillCredit{{QuestID: "boss-hunt", Target: "RootboundWarden", Amount: 1, Maximum: 5}}}}}
	op.BossID = op.BossType + "-" + op.InstanceID
	op.ID = database.BossVictoryID(op.InstanceID, op.BossID)
	op.Fingerprint, _ = database.BossVictoryFingerprint(op)
	return op
}

func bossVictoryEffectPlayer() *Entity {
	player := fullBossLootPlayer()
	player.Name, player.ID = "alice", "player-alice"
	player.Level, player.MaxExperience = 30, experienceRequiredForLevel(30)
	player.Quests = []Quest{{ID: "boss-hunt", Type: "KILL", Target: "RootboundWarden", Count: 2, MaxCount: 5, Accepted: true, RewardGold: 23, RewardGoldQuoted: true}}
	return player
}

func TestBossVictoryCharacterFullBagGrantAndReplayRetainWholeOriginalRoll(t *testing.T) {
	player := bossVictoryEffectPlayer()
	op := bossVictoryEffectFixture(player)
	beforeGold, beforeXP, beforeInventory := player.Gold, player.Experience, cloneItems(player.Inventory)
	progression, changed, err := player.ApplyBossVictoryCharacterEffect(op)
	if err != nil || !changed || progression.XP != 234 || player.Gold != beforeGold+73 || player.Experience != beforeXP+234 || player.Quests[0].Count != 3 || player.Quests[0].Completed || player.Quests[0].RewardGold != 23 || !player.Quests[0].RewardGoldQuoted || !reflect.DeepEqual(player.Inventory, beforeInventory) || len(player.PendingBossLoot) != 1 || player.PendingBossLoot[0] != op.Participants[0].Items[0] || player.ItemDeliveryReceipts[op.ID] != op.Fingerprint {
		t.Fatal("original full-bag victory was partially applied or auto-completed a quest", err)
	}
	player.Gold += 9
	player.Quests[0].Count = 4
	if _, changed, err := player.ApplyBossVictoryCharacterEffect(op); err != nil || changed || player.Gold != beforeGold+82 || player.Quests[0].Count != 4 || len(player.PendingBossLoot) != 1 {
		t.Fatal("same physical boss victory repeated or erased independent credit", err)
	}
	player.Inventory[0] = Item{}
	if count, err := player.CollectPendingBossLootLocked(10); count != 1 || err != nil || player.Inventory[0].Potency != 7 || player.Inventory[0].Stats["damage"] != 73 {
		t.Fatal("later collection lost frozen original metadata", err)
	}
	if _, changed, err := player.ApplyBossVictoryCharacterEffect(op); err != nil || changed || len(player.PendingBossLoot) != 0 {
		t.Fatal("collected original roll was awarded again", err)
	}
}

func TestBossVictoryCharacterPureRefusalsAndLaterQuestProgress(t *testing.T) {
	for _, mode := range []string{"Gold overflow", "XP overflow", "changed fingerprint", "owned item", "future item", "changed quest"} {
		t.Run(mode, func(t *testing.T) {
			player := bossVictoryEffectPlayer()
			op := bossVictoryEffectFixture(player)
			switch mode {
			case "Gold overflow":
				player.Gold = math.MaxInt
			case "XP overflow":
				player.Experience = math.MaxInt
			case "changed fingerprint":
				player.ItemDeliveryReceipts = map[string]string{op.ID: "different-outcome"}
			case "owned item":
				player.Stash = []Item{{ID: "original-blade"}}
			case "future item":
				op.Participants[0].Items = []string{`{"id":"future","stack":1,"maxStack":1,"futureArt":{"keep":true}}`}
				op.Fingerprint, _ = database.BossVictoryFingerprint(op)
			case "changed quest":
				player.Quests[0].Target = "DifferentBoss"
			}
			beforeGold, beforeXP, beforeQuest := player.Gold, player.Experience, player.Quests[0]
			beforeInventory, beforeQueue := cloneItems(player.Inventory), append([]string(nil), player.PendingBossLoot...)
			if _, changed, err := player.ApplyBossVictoryCharacterEffect(op); err == nil || changed || player.Gold != beforeGold || player.Experience != beforeXP || player.Quests[0] != beforeQuest || !reflect.DeepEqual(beforeInventory, player.Inventory) || !reflect.DeepEqual(beforeQueue, player.PendingBossLoot) {
				t.Fatal("refusal partially changed owned boss value")
			}
		})
	}
	for _, completed := range []bool{false, true} {
		player := bossVictoryEffectPlayer()
		op := bossVictoryEffectFixture(player)
		player.Quests[0].Count, player.Quests[0].Completed = 4, completed
		expected := 5
		if completed {
			expected = 4
		}
		if _, changed, err := player.ApplyBossVictoryCharacterEffect(op); err != nil || !changed || player.Quests[0].Count != expected || player.Quests[0].Completed != completed {
			t.Fatal("late original kill erased newer progress/turn-in", err)
		}
	}
}

func TestBossVictoryCharacterCapAndDownedRecoveryUseOriginalWeeklyTime(t *testing.T) {
	player := bossVictoryEffectPlayer()
	player.Level, player.MaxExperience, player.Health, player.State = 100, experienceRequiredForLevel(100), 0, "DEAD"
	op := bossVictoryEffectFixture(player)
	op.BossType = "UmbraPrime"
	op.BossID = op.BossType + "-" + op.InstanceID
	op.ID = database.BossVictoryID(op.InstanceID, op.BossID)
	op.Fingerprint, _ = database.BossVictoryFingerprint(op)
	progression, changed, err := player.ApplyBossVictoryCharacterEffect(op)
	if err != nil || !changed || progression.ResonanceXP != 234 || player.Health != 0 || player.State != "DEAD" || len(player.WeeklyRaidCompletions) != 1 {
		t.Fatal("cap reward or downed recovery changed normal lifecycle", err)
	}
	for _, completedAt := range player.WeeklyRaidCompletions {
		if !completedAt.Equal(op.CreatedAt) {
			t.Fatal("late recovery renewed the original weekly victory time")
		}
	}
}

func TestBossVictoryCharacterIncomingItemsRetainDuringActiveTrade(t *testing.T) {
	player := bossVictoryEffectPlayer()
	player.Inventory[0] = Item{} // It could fit, but the offered bag is frozen.
	op := bossVictoryEffectFixture(player)
	w := newTestWorld()
	defer w.StopBackground()
	w.AddEntity(player)
	w.TradeByPlayer[player.ID] = "consented-trade"
	before := cloneItems(player.Inventory)
	if found, _, changed, err := w.ApplyBossVictoryCharacterEffect(player.ID, op); !found || !changed || err != nil || !reflect.DeepEqual(player.Inventory, before) || len(player.PendingBossLoot) != 1 {
		t.Fatal("incoming victory modified a bag under trade consent", err)
	}
	if _, count, err := w.CollectPendingBossLoot(player.ID, 10); count != 0 || err != nil {
		t.Fatal("incoming trade-protected items were claimed early", err)
	}
	delete(w.TradeByPlayer, player.ID)
	if _, count, err := w.CollectPendingBossLoot(player.ID, 10); count != 1 || err != nil || player.Inventory[0].ID != "original-blade" {
		t.Fatal("retained incoming victory failed ordinary post-trade collection", err)
	}
}

func TestBossVictoryIdentitySurvivesCanonicalSpawnAndRestore(t *testing.T) {
	w := newTestWorld()
	defer w.StopBackground()
	layout := DungeonLayout{}
	appendDungeonRoom(&layout, DungeonRoom{X: 0, Z: 0, Width: 40, Height: 40, Type: "start"})
	appendDungeonRoomAndConnect(&layout, DungeonRoom{X: 0, Z: -100, Width: 40, Height: 40, Type: "normal"}, canonicalDungeonCorridorWidth)
	appendDungeonRoomAndConnect(&layout, DungeonRoom{X: 0, Z: -200, Width: 60, Height: 60, Type: "boss"}, canonicalDungeonCorridorWidth)
	instance := &DungeonInstance{ID: "dungeon_victory_identity", Layout: layout, Difficulty: DifficultyNormal,
		DungeonType: "verdant_bastion_catacombs", RunLevel: 30, RoomState: NewDungeonRoomState(layout), PlayerRoomSummary: map[string]DungeonRoomSummary{}}
	w.storeDungeonInstance(instance.ID, instance)
	w.Mu.Lock()
	w.spawnBossInInstance("RootboundWarden", 0, -200, instance.ID, DifficultyNormal)
	w.Mu.Unlock()
	bossID := "RootboundWarden-" + instance.ID
	original := w.GetEntityCopy(bossID)
	snapshot, found := w.GetDungeonResumeSnapshot(instance.ID)
	if original == nil || !found {
		t.Fatal("canonical encounter could not produce a restart snapshot")
	}
	restored := newTestWorld()
	defer restored.StopBackground()
	if err := restored.RestoreDungeon(snapshot); err != nil {
		t.Fatal(err)
	}
	after := restored.GetEntityCopy(bossID)
	if after == nil || after.SubType != original.SubType || after.SpawnX != original.SpawnX || after.SpawnZ != original.SpawnZ || database.BossVictoryID(instance.ID, original.ID) != database.BossVictoryID(instance.ID, after.ID) {
		t.Fatal("original physical boss acquired another victory key on restore")
	}
	if database.BossVictoryID(instance.ID, bossID) == database.BossVictoryID(instance.ID+"-new-run", bossID) {
		t.Fatal("a separate dungeon run inherited the previous boss victory")
	}
}
