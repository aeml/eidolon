package game

import (
	"fmt"
	"testing"
)

// Calculation and real impact diagnostic, NOT a dungeon win or balance
// approval. Use current factory-created armor to measure how much protection
// the actual item scale buys, rather than testing a synthetic Defense=100.
func TestPartyArmorBudgetAudit(t *testing.T) {
	sets := []struct {
		class string
		names []string
	}{
		{"Fighter", []string{"Wooden Shield", "Iron Helm", "Plate Mail", "Plate Greaves", "Iron Boots", "Iron Gauntlets", "Steel Pauldrons", "Plated Girdle"}},
		{"Rogue", []string{"Wooden Shield", "Leather Cap", "Leather Tunic", "Leather Pants", "Leather Boots", "Leather Gloves", "Reinforced Spaulders", "Studded Belt"}},
		{"Wizard", []string{"Spell Tome", "Silk Hood", "Robes", "Silk Skirt", "Sandals", "Silk Gloves", "Velvet Mantle", "Silk Sash"}},
	}
	for _, level := range []int{30, 70} {
		for _, set := range sets {
			t.Run(fmt.Sprintf("level%d/%s", level, set.class), func(t *testing.T) {
				w := newTestWorld()
				defer w.StopBackground()
				p := newTestPlayer("armor-audit", set.class)
				p.InstanceID, p.X, p.Z = "armor-audit", 60000, 60000
				w.AddEntity(p)
				if _, ok := w.SetPlayerLevel(p.ID, level); !ok {
					t.Fatal("level fixture failed")
				}
				p.Equipment = map[string]Item{}
				for _, name := range set.names {
					found := false
					for _, base := range BaseItems {
						if base.Name != name {
							continue
						}
						item := createItem(base, RarityCommon, 1, 0, level)
						p.Equipment[item.Slot] = *item
						t.Logf("item=%s level=%d defense=%d scale=%d", name, item.Level, item.Stats["defense"], item.StatScaleVersion)
						found = true
						break
					}
					if !found {
						t.Fatalf("missing production base %s", name)
					}
				}
				if len(p.Equipment) != 8 {
					t.Fatal("armor slots collided")
				}
				p.RecalculateStats()
				profile := dungeonEnemyCombatProfile("RootboundWarden", level, DifficultyNormal, dungeonRankBoss, 2.5)
				enemy := &Entity{ID: "warden-audit", Type: TypeEnemy, SubType: "RootboundWarden", InstanceID: p.InstanceID,
					Level: level, X: p.X + 7, Z: p.Z, Scale: 4, State: "IDLE", Health: profile.Health, MaxHealth: profile.MaxHealth,
					BaseStats: profile.BaseStats, Damage: profile.Damage, AttackCooldown: profile.AttackCooldown}
				w.AddEntity(enemy)
				impact := func(label string) {
					p.Health = p.MaxHealth
					before := p.Health
					// Resolve the actual post-wind-up path at legal contact; this
					// does not simulate cooldowns, dodging or an entire encounter.
					w.applyAttackImpact(enemy.ID, p.ID, p.InstanceID, nil, 0)
					damage := before - p.Health
					if damage <= 0 || damage > profile.Damage {
						t.Fatalf("invalid impact %d", damage)
					}
					t.Logf("AUDIT class=%s level=%d state=%s armor=%d boss_raw=%d actual_hit=%d mitigation=%.4f max_hp=%d mana=%d hp_regen=%.4f mana_regen=%.4f",
						set.class, level, label, p.Defense, profile.Damage, damage, 1-float64(damage)/float64(profile.Damage), p.MaxHealth, p.MaxMana, p.HpRegen, p.ManaRegen)
				}
				impact("baseline")
				if set.class == "Fighter" {
					p.UnlockedSkills = []string{"Iron Fortress"}
					p.Mana = p.MaxMana
					before := p.Mana
					result := w.PerformAbility(p.ID, p.X, p.Z, "", "Iron Fortress")
					if !result.Accepted || before-p.Mana != 40 {
						t.Fatalf("paid Fortress: %+v", result)
					}
					impact("paid-fortress")
				}
			})
		}
	}
}
