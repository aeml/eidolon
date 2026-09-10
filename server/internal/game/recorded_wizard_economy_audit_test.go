package game

import (
	"eidolon-server/internal/forging"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"sort"
	"testing"
)

// Read the same historical earned build used by the browser diagnostic. This
// is a disposable calculation probe, not a saved character or combat victory.
func TestRecordedWizardEconomyAudit(t *testing.T) {
	data, err := os.ReadFile("../../../tests/fixtures/earned-wizard-31.json")
	if err != nil {
		t.Fatal(err)
	}
	var record struct {
		SourceCommit   string                     `json:"sourceCommit"`
		Level          int                        `json:"level"`
		Stats          Stats                      `json:"stats"`
		Equipment      map[string]json.RawMessage `json:"equipment"`
		TalentRanks    map[string]int             `json:"talentRanks"`
		SelectedBranch string                     `json:"selectedBranch"`
		UnlockedSkills []string                   `json:"unlockedSkills"`
	}
	if err := json.Unmarshal(data, &record); err != nil {
		t.Fatal(err)
	}
	if record.SourceCommit != "4b3991ffea239bb3152ea93263fbc0bbe95c05a3" || record.Level != 31 || len(record.Equipment) != 14 {
		t.Fatal("audit requires the recorded 14-item level31 build")
	}
	for _, variant := range []struct {
		level int
		forge bool
	}{{31, false}, {32, false}, {31, true}, {32, true}} {
		level := variant.level
		t.Run(fmt.Sprintf("level%d/forge_counterfactual=%t", level, variant.forge), func(t *testing.T) {
			w := newTestWorld()
			p := newTestPlayer("recorded-economy-audit", "Wizard")
			w.AddEntity(p)
			p.Level = level
			p.BaseStats = applyLevelGrowth(record.Stats, level-record.Level+1)
			p.TalentRanks = record.TalentRanks
			p.SelectedBranch = record.SelectedBranch
			p.UnlockedSkills = record.UnlockedSkills
			for slot, encoded := range record.Equipment {
				var fields map[string]json.RawMessage
				if err := json.Unmarshal(encoded, &fields); err != nil {
					t.Fatal(err)
				}
				// Client records wrap rarity metadata; authoritative Item uses its
				// name. Preserve all other item fields, including scaled stats.
				var rarity struct{ Name ItemRarity }
				if err := json.Unmarshal(fields["rarity"], &rarity); err != nil || rarity.Name == "" {
					t.Fatalf("invalid recorded rarity in %s: %v", slot, err)
				}
				fields["rarity"], err = json.Marshal(rarity.Name)
				if err != nil {
					t.Fatal(err)
				}
				encoded, err = json.Marshal(fields)
				if err != nil {
					t.Fatal(err)
				}
				var item Item
				if err := json.Unmarshal(encoded, &item); err != nil {
					t.Fatal(err)
				}
				p.Equipment[slot] = item
			}
			p.RecalculateStats()
			p.Health, p.Mana = p.MaxHealth, p.MaxMana
			wantHP, wantMana := 1140+(level-31)*25, 670+(level-31)*15
			if p.MaxHealth != wantHP || p.MaxMana != wantMana || p.Damage != 22 {
				t.Fatalf("fixture differs from native profile: hp=%d mana=%d damage=%d", p.MaxHealth, p.MaxMana, p.Damage)
			}
			if variant.forge {
				// Explicit counterfactual: quote normal level upgrades and supply
				// exactly their cost to this unit fixture. No claim that the
				// historical character earned or carried these materials.
				slots := make([]string, 0, len(p.Equipment))
				totalCost := 0
				for slot, item := range p.Equipment {
					if item.Level >= level {
						continue
					}
					slots = append(slots, slot)
					_, cost := forging.UpgradeCost(item.Level, level-item.Level)
					totalCost += cost
				}
				sort.Strings(slots)
				p.Inventory = []Item{{ID: "audit-only-shards", Name: "Eidolon Shard", Type: ItemMaterial, Stack: totalCost}}
				for _, slot := range slots {
					before := p.Equipment[slot]
					_, cost := forging.UpgradeCost(before.Level, level-before.Level)
					_, ok, reason := w.PerformForgeUpgrade(p.ID, slot, level-before.Level)
					if !ok || p.Equipment[slot].Level != level || p.Equipment[slot].ID != before.ID {
						t.Fatalf("normal Forge failed for %s: %s", slot, reason)
					}
					t.Logf("COUNTERFACTUAL upgrade slot=%s from=%d to=%d shard_cost=%d stats_before=%v stats_after=%v",
						slot, before.Level, level, cost, before.Stats, p.Equipment[slot].Stats)
				}
				if len(p.Inventory) != 0 || p.Gold != 0 || p.Level != level {
					t.Fatal("Forge must consume exactly the quoted shards without Gold or level changes")
				}
				p.Health, p.Mana = p.MaxHealth, p.MaxMana
				t.Logf("COUNTERFACTUAL total_shards=%d; material availability and earned preparation remain unverified", totalCost)
			}
			before := p.Mana
			result := w.PerformAbility(p.ID, 10, 0, "", "Fireball")
			if !result.Accepted || before-p.Mana <= 0 || p.AttackCooldown <= 0 || result.CooldownRemaining <= 0 {
				t.Fatalf("invalid authoritative cast/economy: %+v", result)
			}
			var projectile *Entity
			for _, entity := range w.Entities {
				if entity.OwnerID == p.ID && entity.ProjectileSkill == "Fireball" {
					if projectile != nil {
						t.Fatal("expected exactly one Fireball")
					}
					projectile = entity
				}
			}
			if projectile == nil || projectile.Damage <= 0 {
				t.Fatal("missing actual Fireball projectile")
			}
			cost := before - p.Mana
			const seconds = 480.0
			casts := min((before+int(math.Floor(p.ManaRegen*seconds)))/cost, 1+int(seconds/result.CooldownRemaining))
			basics := 1 + int(seconds/p.AttackCooldown.Seconds())
			boss := dungeonEnemyCombatProfile("RootboundWarden", 30, DifficultyNormal, dungeonRankBoss, 2.5)
			t.Logf("level=%d stats=%+v hp=%d mana=%d regen=%.4f basic=%d interval=%.4fs fireball=%d cost=%d cooldown=%.4fs full_bar_casts=%d full_bar_raw=%d eight_min_casts=%d stationary_basics=%d stationary_raw_reference=%d boss_hp=%d",
				level, p.Stats, p.MaxHealth, before, p.ManaRegen, p.Damage, p.AttackCooldown.Seconds(), projectile.Damage,
				cost, result.CooldownRemaining, before/cost, before/cost*projectile.Damage, casts, basics,
				casts*projectile.Damage+basics*p.Damage, boss.MaxHealth)
			t.Log("Reference ignores crit/variance/mitigation, movement, misses, animation and action contention; not a combat simulation or balance approval.")
		})
	}
}
