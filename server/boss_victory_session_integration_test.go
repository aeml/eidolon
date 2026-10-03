package main

import (
	"context"
	"fmt"
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Prepared class-appropriate uncommon/rare gear and a saved pre-boss layout;
// earned value is NOT seeded. Real four-class party consent, ordinary attacks
// and spells must kill the actual restored first guardian. One real Mongo
// rejection and actual SIGKILL then exercise original-cohort startup recovery.
func TestBossVictoryActualPartyKillCrashAndRecovery(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	instanceID := fmt.Sprintf("dungeon_boss_socket_%d", time.Now().UnixNano())
	resume := roomPreparedResume(instanceID)
	resume.CurrentRoomIndexValue = 2
	resume.Rooms[0].Cleared, resume.Rooms[0].Explored = true, true
	resume.Rooms[1].Cleared, resume.Rooms[1].Rewarded, resume.Rooms[1].Explored = true, true, true
	if err := game.ValidateDungeonLayout(dungeonResumeFromDatabase(resume).Layout); err != nil {
		t.Fatal(err)
	}
	classes := []string{"Fighter", "Cleric", "Wizard", "Rogue"}
	weapons := []string{"iron-sword", "cleric-mace", "wooden-staff", "steel-dagger"}
	primary := []string{"strength", "wisdom", "intelligence", "dexterity"}
	fixtures, passwords := make([]*database.Character, 4), make([]string, 4)
	for i, class := range classes {
		fixture, password := resourceJournalFixture(t, repo)
		fixture.Class, fixture.InstanceID, fixture.DungeonProgress, fixture.SelectedBranch = class, instanceID, resume, "A"
		fixture.LastLogout, fixture.X, fixture.Z, fixture.EP = time.Now(), 19993.5, 19850+float64(i)*.3, 43
		fixture.Quests = []database.Quest{{ID: "earned-guardian-credit", Type: "KILL", Target: "RootboundWarden", MaxCount: 1, Accepted: true}}
		fixture.Stats = database.Stats{Strength: 39, Dexterity: 39, Wisdom: 39, Intelligence: 39, Vitality: 68}
		fixture.Resources = &database.CharacterResources{Version: 1, Health: 10000, Mana: 10000}
		switch class {
		case "Fighter":
			fixture.Stats.Strength = 68
			fixture.UnlockedSkills = []string{"Charge", "Whirlwind", "Shield Slam", "Iron Fortress"}
		case "Cleric":
			fixture.Stats.Wisdom = 68
			fixture.UnlockedSkills = []string{"Radiant Strike", "Healing Light", "Guardian Embrace", "Purifying Wave"}
		case "Wizard":
			fixture.Stats.Intelligence = 68
			fixture.UnlockedSkills = []string{"Fireball", "Flame Whip", "Flame Tornado", "Meteor Drop"}
		case "Rogue":
			fixture.Stats.Dexterity = 68
			fixture.UnlockedSkills = []string{"Piercing Throw", "Backstab", "Weak Point Mark", "Shadow Lunge"}
		}
		fixture.Equipment = map[string]database.Item{}
		for gearIndex, itemID := range []string{weapons[i], "silk-hood", "robes", "silk-skirt", "sandals", "silk-gloves", "velvet-mantle", "silk-sash", "gold-ring", "silver-ring"} {
			rarity := game.RarityUncommon
			if gearIndex%2 == 0 {
				rarity = game.RarityRare
			}
			items, err := game.GenerateAdminItems(game.AdminItemSpec{Item: itemID, Rarity: rarity, Level: 30, Quantity: 1})
			if err != nil {
				t.Fatal(err)
			}
			item := items[0]
			// Fixture gear has a modest matching primary affix, not inflated
			// damage, extra levels, invulnerability or stat benefit scaling.
			item.Stats[primary[i]] = 8
			slot := item.Slot
			if slot == "ring" {
				slot = "ring1"
				if _, exists := fixture.Equipment[slot]; exists {
					slot = "ring2"
				}
			}
			fixture.Equipment[slot] = databaseItem(item)
		}
		if class == "Rogue" {
			items, err := game.GenerateAdminItems(game.AdminItemSpec{Item: "steel-dagger", Rarity: game.RarityRare, Level: 30, Quantity: 1})
			if err != nil {
				t.Fatal(err)
			}
			items[0].Stats[primary[i]] = 8
			fixture.Equipment["offHand"] = databaseItem(items[0])
		}
		if class == "Cleric" {
			fixture.Inventory = make([]database.Item, game.MaxInventorySize)
			for slot := range fixture.Inventory {
				fixture.Inventory[slot] = database.Item{ID: fmt.Sprintf("boss-full-%d", slot), Name: "Owned material", Type: "MATERIAL", Stack: 1, MaxStack: 1}
			}
		}
		if err := repo.SaveCharacter(fixture.Name, fixture); err != nil {
			t.Fatal(err)
		}
		fixtures[i], passwords[i] = fixture, password
	}
	dir := t.TempDir()
	journal, err := database.OpenCharacterSaveJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	admin, err := mongo.Connect(t.Context(), options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = admin.Disconnect(context.Background()) })
	setValidator := func(value bson.M) {
		t.Helper()
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := admin.Database("eidolon").RunCommand(ctx, bson.D{{Key: "collMod", Value: "users"}, {Key: "validator", Value: value}, {Key: "validationLevel", Value: "strict"}, {Key: "validationAction", Value: "error"}}).Err(); err != nil {
			t.Fatal(err)
		}
	}
	t.Cleanup(func() { setValidator(bson.M{}) })
	address, crash := compatStartServerWithCrash(t, binary, uri, 745, true, "-save-journal-dir", dir)
	probes := make([]*roomSocketProbe, 4)
	for i, fixture := range fixtures {
		connection, _ := resourceLoginCharacter(t, address, fixture.Name, passwords[i], fixture.Class)
		if scene := resourceReadScene(t, connection); scene.InstanceID != instanceID {
			t.Fatal("ordinary pre-boss resume failed")
		}
		probes[i] = roomSocketMonitor(t, connection)
	}
	for i := 1; i < len(probes); i++ {
		resourceSend(t, probes[0].connection, MsgPartyInvite, PartyInvitePayload{TargetName: fixtures[i].Name})
		var invite PartyRequestPayload
		probes[i].waitMessage(t, MsgPartyRequest, &invite)
		resourceSend(t, probes[i].connection, MsgPartyResponse, PartyResponsePayload{InviterName: fixtures[0].Name, InvitationID: invite.InvitationID, Accepted: true})
		probes[i].waitMessage(t, MsgPartyUpdate, nil)
	}
	bossID := "RootboundWarden-" + instanceID
	operationID := database.BossVictoryID(instanceID, bossID)
	setValidator(bson.M{"$or": bson.A{bson.M{"username": bson.M{"$ne": fixtures[3].Name}}, bson.M{"characters.item_delivery_receipts." + operationID: bson.M{"$exists": false}}}})
	deadline, lastSkills := time.Now().Add(70*time.Second), time.Time{}
	ticker := time.NewTicker(250 * time.Millisecond)
	defer ticker.Stop()
	var record *database.BossVictoryRecord
	for time.Now().Before(deadline) {
		<-ticker.C
		record, err = repo.GetBossVictory(operationID)
		if err != nil {
			t.Fatal(err)
		}
		if record != nil {
			break
		}
		for _, probe := range probes {
			resourceSend(t, probe.connection, MsgAttack, AttackPayload{TargetID: bossID})
		}
		if time.Since(lastSkills) >= 1200*time.Millisecond {
			lastSkills = time.Now()
			for i, skill := range []string{"Shield Slam", "Healing Light", "Fireball", "Piercing Throw"} {
				target := bossID
				if i == 1 {
					target = "player-" + fixtures[0].Name
				}
				resourceSend(t, probes[i].connection, MsgAbility, AbilityPayload{SkillName: skill, TargetID: target, TargetX: 20000, TargetZ: 19850})
			}
		}
	}
	if record == nil || record.Validate() != nil || len(record.Participants) != 4 || record.State != database.BossVictoryPending {
		t.Fatal("ordinary four-class combat did not earn its original guardian cohort", record)
	}
	for i, skill := range []string{"Shield Slam", "Healing Light", "Fireball", "Piercing Throw"} {
		probes[i].mu.Lock()
		accepted := probes[i].acceptedSkills[skill]
		probes[i].mu.Unlock()
		if accepted == 0 {
			t.Fatal("ordinary class-kit action was never accepted", classes[i], skill)
		}
	}
	for _, i := range []int{0, 1, 2} {
		probes[i].waitMessage(t, MsgRewardSummary, nil)
		saved, err := repo.GetDirectTradeCharacter(fixtures[i].Name, fixtures[i].Name)
		if err != nil || !database.BossVictoryCharacterReceiptMatches(saved, record.BossVictoryOperation) || saved.Quests[0].Count != 1 || saved.Quests[0].Completed || !saved.DungeonProgress.Rooms[2].Cleared {
			t.Fatal("boss feedback preceded actual saved reward, kill credit or checkpoint", err)
		}
		if i == 1 && len(saved.PendingBossLoot) == 0 {
			t.Fatal("full Cleric bag lost original private boss loot")
		}
	}
	var pending *database.PendingCharacterSave
	for until := time.Now().Add(5 * time.Second); time.Now().Before(until); {
		pending, err = journal.Read(fixtures[3].Name)
		if err != nil {
			t.Fatal(err)
		}
		if pending != nil {
			break
		}
		time.Sleep(25 * time.Millisecond)
	}
	if pending == nil {
		t.Fatal("rejected Rogue claim lost its complete filesystem journal")
	}
	planned, err := pending.Character()
	if err != nil || !database.BossVictoryCharacterReceiptMatches(planned, record.BossVictoryOperation) {
		t.Fatal("rejected post-image lost its original victory fingerprint", err)
	}
	crash()
	for _, probe := range probes {
		_ = probe.connection.Close()
		<-probe.done
	}
	setValidator(bson.M{})
	address, stop := compatStartServer(t, binary, uri, 746, "-save-journal-dir", dir)
	recoveredRecord, err := repo.GetBossVictory(operationID)
	if err != nil || recoveredRecord == nil || recoveredRecord.State != database.BossVictoryComplete || !reflect.DeepEqual(record.BossVictoryOperation, recoveredRecord.BossVictoryOperation) {
		t.Fatal("fresh server lost or rerolled the actual earned cohort", err)
	}
	for i, fixture := range fixtures {
		saved, err := repo.GetDirectTradeCharacter(fixture.Name, fixture.Name)
		participant, eligible := database.BossVictoryRecipientFor(record.BossVictoryOperation, fixture.Name)
		if err != nil || !eligible || !database.BossVictoryCharacterReceiptMatches(saved, record.BossVictoryOperation) || saved.Gold != fixture.Gold+participant.Gold ||
			saved.Quests[0].Count != 1 || saved.Quests[0].Completed || saved.EP != fixture.EP || !reflect.DeepEqual(saved.Equipment, fixture.Equipment) ||
			!saved.DungeonProgress.Rooms[2].Cleared || saved.DungeonProgress.CreatedAt != resume.CreatedAt {
			t.Fatal("recovery lost original private credit or changed gear, EP, quest turn-in or run age", err)
		}
		if i == 3 && (saved.Gold != planned.Gold || saved.XP != planned.XP || !reflect.DeepEqual(saved.Inventory, planned.Inventory)) {
			t.Fatal("fresh startup did not recover the rejected exact Rogue post-image")
		}
	}
	connection, _ := resourceLoginCharacter(t, address, fixtures[0].Name, passwords[0], fixtures[0].Class)
	if scene := resourceReadScene(t, connection); scene.InstanceID != instanceID {
		t.Fatal("recovered ordinary dungeon resume failed")
	}
	probe := roomSocketMonitor(t, connection)
	seen := false
	for until := time.Now().Add(5 * time.Second); time.Now().Before(until); {
		probe.mu.Lock()
		self, boss := probe.actors["player-"+fixtures[0].Name], probe.actors[bossID]
		seen = self != nil && self.InstanceId == instanceID
		alive := boss != nil && boss.State != "DEAD" && boss.Health > 0
		probe.mu.Unlock()
		if alive {
			t.Fatal("saved cleared boss respawned after startup recovery")
		}
		if seen {
			break
		}
		time.Sleep(25 * time.Millisecond)
	}
	if !seen {
		t.Fatal("no actual recovered dungeon scene frame received")
	}
	_ = connection.Close()
	<-probe.done
	stop()
}
