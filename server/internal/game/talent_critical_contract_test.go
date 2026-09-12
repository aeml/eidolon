package game

import (
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"testing"
)

func TestSharedCriticalCatalogMatchesAllServerTalents(t *testing.T) {
	data, err := os.ReadFile("testdata/talent_critical.json")
	if err != nil {
		t.Fatal(err)
	}
	var catalog map[string]struct {
		Technique          float64            `json:"technique"`
		TechniqueOverrides map[string]float64 `json:"techniqueOverrides"`
		Generic            map[string]float64 `json:"generic"`
	}
	if err := json.Unmarshal(data, &catalog); err != nil {
		t.Fatal(err)
	}
	for class, prefix := range map[string]string{"Fighter": "FTR", "Rogue": "ROG", "Wizard": "WIZ", "Cleric": "CLR"} {
		entry, ok := catalog[class]
		if !ok {
			t.Fatalf("missing %s critical contract", class)
		}
		for number := 1; number <= 40; number++ {
			id := fmt.Sprintf("%s_%02d", prefix, number)
			def, ok := talentDefForID(class, id)
			if !ok {
				t.Fatalf("missing %s definition", id)
			}
			want := entry.Generic[strconv.Itoa(number)]
			if number <= 26 && number%2 == 0 {
				want = entry.Technique
				if override, ok := entry.TechniqueOverrides[strconv.Itoa(number)]; ok {
					want = override
				}
			}
			if def.PerRank.SkillCritChance != want {
				t.Errorf("%s chance=%v want=%v", id, def.PerRank.SkillCritChance, want)
			}
		}
	}
}
