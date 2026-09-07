package game

import (
	"encoding/json"
	"fmt"
	"os"
	"reflect"
	"testing"
)

func TestSerratedRuneDoesNotReceiveInactiveBuffMastery(t *testing.T) {
	for _, rank := range []int{0, 5} {
		t.Run(fmt.Sprint(rank), func(t *testing.T) {
			w := newTestWorld()
			p := newTestPlayer("rune-only-caster", "Rogue")
			p.Level, p.X, p.Z, p.InstanceID = 100, 60000, 60000, "dungeon_rune_only"
			p.Stats.Dexterity, p.Damage, p.CritChanceBonus = 180, 100, 0
			p.UnlockedSkills = []string{"Piercing Throw", "Serrated Edges"}
			p.SkillRunes = map[string]string{"Piercing Throw": "piercingthrow_serrated"}
			p.TalentRanks = map[string]int{"ROG_13": rank}
			w.storeDungeonInstance(p.InstanceID, &DungeonInstance{Layout: DungeonLayout{WalkRects: []DungeonWalkRect{{X: p.X, Z: p.Z, Width: 100, Height: 100}}}})
			w.AddEntity(p)
			target := &Entity{ID: "rune-only-target", Type: TypeEnemy, SubType: "Skeleton", InstanceID: p.InstanceID,
				X: p.X + 6, Z: p.Z, SpawnX: p.X + 6, SpawnZ: p.Z, Scale: 1, State: "IDLE", Health: 10000, MaxHealth: 10000}
			w.AddEntity(target)
			beforeMana := p.Mana
			result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, "Piercing Throw")
			if !result.Accepted || p.Mana >= beforeMana || p.SerratedEdgesActive {
				t.Fatalf("paid rune-only cast failed: %+v", result)
			}
			for step := 0; step < 30 && target.Health == target.MaxHealth; step++ {
				for _, e := range w.Entities {
					if e.Type == TypeProjectile && e.OwnerID == p.ID {
						w.updateEntity(e, .05, nil, &deferredActions{})
					}
				}
			}
			want := (target.MaxHealth - target.Health) / 5
			if want <= 0 || target.BleedDamage != want || target.BleedSourceID != p.ID {
				t.Fatalf("inactive Mastery changed rune bleed: got %d want %d", target.BleedDamage, want)
			}
		})
	}
}

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
