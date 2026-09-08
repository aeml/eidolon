package main

import (
	"encoding/json"
	"sync"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"go.mongodb.org/mongo-driver/bson"
)

func TestOpeningQuotedRewardSurvivesDatabaseAndDailyRefresh(t *testing.T) {
	for _, xp := range []int{0, 100, 500} {
		p := newLevelCommandPlayer("opening-save")
		p.Quests = []game.Quest{{ID: "chronicle_01_bell_below", Type: "KILL", Target: "Skeleton",
			Category: game.QuestCategoryChronicle, Accepted: true, Count: 2, MaxCount: 3,
			RewardXP: xp, RewardGold: 100}}
		snapshot := characterSnapshot("opening-save", p, time.Now())
		encoded, err := bson.Marshal(snapshot)
		if err != nil {
			t.Fatal(err)
		}
		var stored database.Character
		if err := bson.Unmarshal(encoded, &stored); err != nil {
			t.Fatal(err)
		}
		loaded := newLevelCommandPlayer("opening-loaded")
		for _, q := range stored.Quests {
			loaded.Quests = append(loaded.Quests, questFromDatabase(q))
		}
		w := game.NewWorld(nil)
		w.AddEntity(loaded)
		for i := 0; i < 2; i++ {
			w.GenerateDailyQuests(loaded.ID)
			q := loaded.Quests[0]
			if q.RewardXP != xp || q.RewardGold != 100 || q.Count != 2 || q.MaxCount != 3 || !q.Accepted || q.Completed {
				t.Fatalf("save/refresh changed an accepted %d-XP opening quote: %+v", xp, q)
			}
		}
	}
}

func TestCollectionRequestDuringCombatUsesStableQuestSnapshot(t *testing.T) {
	previousWorld, previousDB := world, db
	defer func() { world, db = previousWorld, previousDB }()
	world, db = game.NewWorld(nil), nil
	client := newLevelCommandClient()
	player := newLevelCommandPlayer(client.playerID)
	player.Quests = []game.Quest{
		{ID: "chronicle_01_bell_below", Accepted: true, Completed: true, Count: 3},
		{ID: "chronicle_02_seeds_first_grove", Type: "COLLECT", Target: "Verdant Memory Seed",
			Category: game.QuestCategoryChronicle, Accepted: true, MaxCount: 8, CollectionVersion: 2},
	}
	world.AddEntity(player)
	world.GenerateDailyQuests(player.ID)
	var worker sync.WaitGroup
	worker.Add(1)
	go func() {
		defer worker.Done()
		for i := 0; i < 10000; i++ {
			player.Mu.Lock()
			game.ChronicleDropForKill(player, "Skeleton", .99)
			player.Mu.Unlock()
		}
	}()
	defer worker.Wait()
	for i := 0; i < 100; i++ {
		client.dispatchMessage(Message{Type: MsgRequestQuests})
		messages := drainSentMessages(client.send)
		if len(messages) != 1 || messages[0].Type != MsgQuestUpdate {
			t.Fatal("quest request lost its response")
		}
		var quests []game.Quest
		if err := json.Unmarshal(messages[0].Payload, &quests); err != nil {
			t.Fatal(err)
		}
		q := quests[1]
		if q.CollectionVersion != 2 || q.MaxCount != 8 || q.DropMisses < 0 || q.DropMisses > 4 {
			t.Fatalf("invalid collection snapshot: %+v", q)
		}
	}
}

func TestCollectionContractAndBadLuckSurviveDatabaseRoundTrip(t *testing.T) {
	for _, version := range []int{0, 1, 2} {
		player := newLevelCommandPlayer("collection-save")
		count, misses := 4, 0
		if version == 2 {
			count, misses = 8, 4
		}
		player.Quests = []game.Quest{
			{ID: "chronicle_01_bell_below", Accepted: true, Completed: true, Count: 3},
			{ID: "chronicle_02_seeds_first_grove", Type: "COLLECT", Target: "Verdant Memory Seed",
				Category: game.QuestCategoryChronicle, Accepted: true, Count: 2, MaxCount: count,
				CollectionVersion: version, DropMisses: misses},
		}
		// Production snapshot -> BSON representation -> production login mapper.
		snapshot := characterSnapshot("collection-save", player, time.Now())
		encoded, err := bson.Marshal(snapshot)
		if err != nil {
			t.Fatal(err)
		}
		var stored database.Character
		if err := bson.Unmarshal(encoded, &stored); err != nil {
			t.Fatal(err)
		}
		loaded := newLevelCommandPlayer("collection-loaded")
		for _, q := range stored.Quests {
			loaded.Quests = append(loaded.Quests, questFromDatabase(q))
		}
		w := game.NewWorld(nil)
		w.AddEntity(loaded)
		w.GenerateDailyQuests(loaded.ID)
		q := loaded.Quests[1]
		if q.Count != 2 || q.MaxCount != count || q.DropMisses != misses || q.CollectionVersion != max(1, version) {
			t.Fatalf("version=%d lost saved contract/state: %+v", version, q)
		}
		roll := .64
		if version == 2 {
			roll = .99
		}
		if game.ChronicleDropForKill(loaded, "Skeleton", roll) == nil {
			t.Fatalf("version=%d lost legacy drop rule or saved guarantee", version)
		}
	}
}
