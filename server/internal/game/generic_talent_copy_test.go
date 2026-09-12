package game

import (
	"encoding/json"
	"os"
	"reflect"
	"testing"
)

func TestGenericTalentCopyMatchesExistingServerDefinitions(t *testing.T) {
	data, err := os.ReadFile("testdata/generic_talent_copy.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases []struct {
		ClassName   string      `json:"className"`
		ID          string      `json:"id"`
		Description string      `json:"description"`
		Bonus       TalentBonus `json:"bonus"`
	}
	if err := json.Unmarshal(data, &cases); err != nil {
		t.Fatal(err)
	}
	seen, counts := map[string]bool{}, map[string]int{}
	for _, tc := range cases {
		if seen[tc.ID] || tc.Description == "" {
			t.Fatalf("duplicate or incomplete contract %s", tc.ID)
		}
		seen[tc.ID] = true
		counts[tc.ClassName]++
		t.Run(tc.ID, func(t *testing.T) {
			definition, ok := talentDefForID(tc.ClassName, tc.ID)
			if !ok || definition.MaxRank != 5 || !reflect.DeepEqual(definition.PerRank, tc.Bonus) {
				t.Fatalf("copy contract does not match existing definition: got %+v want %+v", definition, tc.Bonus)
			}
		})
	}
	if !reflect.DeepEqual(counts, map[string]int{"Fighter": 8, "Rogue": 8, "Wizard": 5, "Cleric": 7}) {
		t.Fatalf("missing class copy coverage: %+v", counts)
	}
}
