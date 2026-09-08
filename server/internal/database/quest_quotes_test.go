package database

import (
	"testing"

	"go.mongodb.org/mongo-driver/bson"
)

func TestQuestRewardQuoteFieldPresence(t *testing.T) {
	for _, tc := range []struct {
		name     string
		fields   bson.M
		xp, gold bool
	}{
		{"missing", bson.M{}, false, false},
		{"explicit zero", bson.M{"reward_xp": 0, "reward_gold": 0}, true, true},
		{"XP only", bson.M{"reward_xp": 500}, true, false},
		{"zero XP only", bson.M{"reward_xp": 0}, true, false},
		{"gold only", bson.M{"reward_gold": 25}, false, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			encoded, err := bson.Marshal(bson.M{"quests": []bson.M{tc.fields}})
			if err != nil {
				t.Fatal(err)
			}
			var char Character
			if err := bson.Unmarshal(encoded, &char); err != nil {
				t.Fatal(err)
			}
			if len(char.Quests) != 1 {
				t.Fatal("quest lost in nested character decode")
			}
			q := char.Quests[0]
			if q.RewardXPQuoted != tc.xp || q.RewardGoldQuoted != tc.gold {
				t.Fatalf("wrong quote provenance: %+v", q)
			}
			// Production save writes explicit amounts, not the derived flags.
			saved, err := bson.Marshal(q)
			if err != nil {
				t.Fatal(err)
			}
			var raw bson.M
			if err := bson.Unmarshal(saved, &raw); err != nil {
				t.Fatal(err)
			}
			if _, exists := raw["rewardxpquoted"]; exists {
				t.Fatal("derived metadata persisted")
			}
			var reloaded Quest
			if err := bson.Unmarshal(saved, &reloaded); err != nil {
				t.Fatal(err)
			}
			if !reloaded.RewardXPQuoted || !reloaded.RewardGoldQuoted {
				t.Fatal("saved amounts not treated as explicit")
			}
		})
	}
}
