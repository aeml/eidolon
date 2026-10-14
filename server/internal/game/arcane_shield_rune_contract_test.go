package game

import (
	"encoding/json"
	"os"
	"testing"
)

func TestPaidArcaneShieldRuneSharedOfflineContract(t *testing.T) {
	data, err := os.ReadFile("testdata/arcane_shield_runes.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases []struct {
		Name, Rune                         string
		Ranks                              map[string]int
		Hits                               []int
		Shield, Absorbed, OwnerHP, EnemyHP int
		Active                             bool
	}
	if err := json.Unmarshal(data, &cases); err != nil {
		t.Fatal(err)
	}
	for _, tc := range cases {
		t.Run(tc.Name, func(t *testing.T) {
			w := newTestWorld()
			owner := newTestPlayer("shield-owner", "Wizard")
			owner.Level, owner.X, owner.Z, owner.InstanceID = 100, 60000, 60000, "dungeon_shield_contract"
			owner.Stats.Intelligence, owner.Defense, owner.Health, owner.MaxHealth = 10, 0, 1000, 1000
			owner.UnlockedSkills = []string{"Arcane Shield"}
			owner.SkillRunes = map[string]string{"Arcane Shield": tc.Rune}
			owner.TalentRanks = tc.Ranks
			enemy := &Entity{ID: "shield-attacker", Type: TypeEnemy, SubType: "Skeleton", InstanceID: owner.InstanceID,
				X: owner.X + 1, Z: owner.Z, Health: 1000, MaxHealth: 1000, State: "IDLE"}
			w.AddEntity(owner)
			w.AddEntity(enemy)
			beforeMana := owner.Mana
			if result := w.PerformAbility(owner.ID, owner.X, owner.Z, "", "Arcane Shield"); !result.Accepted || owner.Mana != beforeMana-40 {
				t.Fatalf("paid cast rejected: %+v", result)
			}
			owner.SkillRunes = nil
			owner.TalentRanks = nil
			owner.CritChanceBonus = 1
			for _, hit := range tc.Hits {
				enemy.Damage = hit
				w.applyAttackImpact(enemy.ID, owner.ID, owner.InstanceID, nil, 0)
			}
			if owner.Health != tc.OwnerHP || enemy.Health != tc.EnemyHP || owner.ArcaneShieldHP != tc.Shield ||
				owner.ArcaneShieldAbsorbed != tc.Absorbed || owner.ArcaneShieldActive != tc.Active {
				t.Fatalf("rune mismatch: hp=%d enemy=%d shield=%d absorbed=%d active=%v", owner.Health, enemy.Health,
					owner.ArcaneShieldHP, owner.ArcaneShieldAbsorbed, owner.ArcaneShieldActive)
			}
			if !tc.Active && owner.ArcaneShieldRuneID != "" {
				t.Fatal("depleted shield retained rune")
			}
		})
	}
}
