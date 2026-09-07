package main

import (
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"go.mongodb.org/mongo-driver/bson"
)

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
