package game

import (
	"encoding/json"
	"os"
	"testing"
)

func TestBasicAttackDamageSharedClientFixture(t *testing.T) {
	data, err := os.ReadFile("testdata/basic_attack_damage.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixtures []struct {
		ClassName  string `json:"className"`
		Stats      Stats  `json:"stats"`
		FlatDamage int    `json:"flatDamage"`
		Damage     int    `json:"damage"`
	}
	if err := json.Unmarshal(data, &fixtures); err != nil {
		t.Fatal(err)
	}
	if len(fixtures) != 4 {
		t.Fatal("expected all four classes")
	}
	for _, fixture := range fixtures {
		e := &Entity{Type: TypePlayer, SubType: fixture.ClassName, Level: 1, BaseStats: fixture.Stats,
			Equipment: map[string]Item{"mainHand": {Level: 1, Stats: map[string]int{"damage": fixture.FlatDamage}}}}
		e.RecalculateStats()
		if e.Damage != fixture.Damage {
			t.Fatalf("%s got %d want %d", fixture.ClassName, e.Damage, fixture.Damage)
		}
	}
}
