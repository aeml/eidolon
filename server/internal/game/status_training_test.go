package game

import (
	"encoding/json"
	"os"
	"reflect"
	"testing"
)

func TestStatusTrainingSharedContract(t *testing.T) {
	data, err := os.ReadFile("testdata/status_training.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases []struct {
		Name, Class, Skill string
		Ranks              map[string]int
		Amount, Want       int
		Inherited          bool
	}
	if err := json.Unmarshal(data, &cases); err != nil {
		t.Fatal(err)
	}
	for _, tc := range cases {
		t.Run(tc.Name, func(t *testing.T) {
			p := &Entity{SubType: tc.Class, TalentRanks: tc.Ranks}
			before := make(map[string]int)
			for id, rank := range tc.Ranks {
				before[id] = rank
			}
			if got := trainedStatusDamage(p, tc.Skill, tc.Amount, tc.Inherited); got != tc.Want {
				t.Fatalf("got %d want %d", got, tc.Want)
			}
			if !reflect.DeepEqual(before, p.TalentRanks) {
				t.Fatal("damage calculation mutated saved ranks")
			}
		})
	}
}
