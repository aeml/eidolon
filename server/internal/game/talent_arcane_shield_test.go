package game

import (
	"encoding/json"
	"math"
	"os"
	"reflect"
	"testing"
	"time"
)

func TestArcaneShieldTrainingPaidCastsAndActualAbsorption(t *testing.T) {
	data, err := os.ReadFile("testdata/arcane_shield_training.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases []struct {
		Name, Rune string
		Ranks      map[string]int
		Capacity   int
		Duration   float64
		Focus      bool
	}
	if err := json.Unmarshal(data, &cases); err != nil {
		t.Fatal(err)
	}
	for _, tc := range cases {
		t.Run(tc.Name, func(t *testing.T) {
			w := newTestWorld()
			p := newTestPlayer("shield-owner", "Wizard")
			p.Level, p.X, p.Z, p.InstanceID = 100, 60000, 60000, "dungeon_shield"
			p.Stats.Intelligence, p.Defense, p.Health, p.MaxHealth = 10, 0, 1000, 1000
			p.UnlockedSkills = []string{"Arcane Shield"}
			p.TalentRanks = tc.Ranks
			originalRanks := make(map[string]int)
			for id, rank := range tc.Ranks {
				originalRanks[id] = rank
			}
			p.SkillRunes = map[string]string{"Arcane Shield": tc.Rune}
			p.SpellFocusActive = tc.Focus
			w.AddEntity(p)
			beforeMana, start := p.Mana, time.Now()
			result := w.PerformAbility(p.ID, p.X, p.Z, "", "Arcane Shield")
			if !result.Accepted || p.Mana != beforeMana-40 {
				t.Fatalf("paid shield failed: %+v, mana %d -> %d", result, beforeMana, p.Mana)
			}
			if p.ArcaneShieldHP != tc.Capacity {
				t.Errorf("shield = %d, want %d", p.ArcaneShieldHP, tc.Capacity)
			}
			if duration := p.ArcaneShieldEndTime.Sub(start).Seconds(); math.Abs(duration-tc.Duration) > .1 {
				t.Errorf("duration = %f, want %f", duration, tc.Duration)
			}
			if p.SpellFocusActive != tc.Focus {
				t.Error("defensive cast consumed Spell Focus")
			}
			if !reflect.DeepEqual(p.TalentRanks, originalRanks) {
				t.Error("casting rewrote persisted talent ranks")
			}
			enemy := &Entity{ID: "shield-attacker", Type: TypeEnemy, SubType: "Skeleton", InstanceID: p.InstanceID,
				X: p.X + 1, Z: p.Z, Damage: 200, Health: 1000, MaxHealth: 1000, State: "IDLE"}
			w.AddEntity(enemy)
			w.applyAttackImpact(enemy.ID, p.ID, p.InstanceID, nil, 0)
			if p.Health != 1000-(200-tc.Capacity) {
				t.Errorf("health after actual impact = %d, want %d", p.Health, 1000-(200-tc.Capacity))
			}
			if p.ArcaneShieldActive || p.ArcaneShieldHP != 0 {
				t.Error("depleted shield remained active")
			}
		})
	}
}

func TestTrainedArcaneShieldRunesUseActualAbsorbedDamage(t *testing.T) {
	for _, tc := range []struct {
		rune       string
		wantDamage int
	}{
		{"arcaneshield_reflective", 54}, {"arcaneshield_explosive", 180},
	} {
		t.Run(tc.rune, func(t *testing.T) {
			w := newTestWorld()
			p := newTestPlayer("shield-owner", "Wizard")
			p.Level, p.X, p.Z, p.InstanceID = 100, 60000, 60000, "dungeon_shield"
			p.Stats.Intelligence, p.Defense, p.Health, p.MaxHealth = 10, 0, 1000, 1000
			p.TalentRanks = map[string]int{"WIZ_21": 5}
			p.UnlockedSkills = []string{"Arcane Shield"}
			p.SkillRunes = map[string]string{"Arcane Shield": tc.rune}
			w.AddEntity(p)
			if result := w.PerformAbility(p.ID, p.X, p.Z, "", "Arcane Shield"); !result.Accepted {
				t.Fatalf("shield rejected: %+v", result)
			}
			p.TalentRanks = nil // The paid shield snapshots capacity until depletion.
			enemy := &Entity{ID: "shield-attacker", Type: TypeEnemy, SubType: "Skeleton", InstanceID: p.InstanceID,
				X: p.X + 1, Z: p.Z, Damage: 200, Health: 1000, MaxHealth: 1000, State: "IDLE"}
			w.AddEntity(enemy)
			w.applyAttackImpact(enemy.ID, p.ID, p.InstanceID, nil, 0)
			if enemy.Health != 1000-tc.wantDamage {
				t.Errorf("rune damage = %d, want %d", 1000-enemy.Health, tc.wantDamage)
			}
			if p.Health != 980 || p.ArcaneShieldActive {
				t.Errorf("trained depletion failed: health=%d active=%t", p.Health, p.ArcaneShieldActive)
			}
		})
	}
}
